import { DEFAULTS } from '../constants/defaults';
import { TRACKER_OPERATION } from '../constants/tracker';
import { ErrorHandler } from '../errors/ErrorHandler';
import type { TrackerHealthResult } from '../types/core';
import type { Tracker, TrackerConfig, TrackerRuntimeConfig } from '../types/tracker';
import { withTimeout } from '../utils/withTimeout';

export interface TrackerEntry {
  readonly tracker: Tracker<any>;
  enabled: boolean;
  include?: readonly string[] | undefined;
  exclude?: readonly string[] | undefined;
  timeoutMs: number;
  initialization?: Promise<void> | undefined;
}

export class TrackerManager {
  private readonly entries = new Map<string, TrackerEntry>();
  private entriesList: readonly TrackerEntry[] = [];

  constructor(private readonly errors: ErrorHandler) {}

  async register(config: TrackerConfig<any>): Promise<void> {
    const { tracker } = config;
    if (!tracker?.id) throw new Error('A tracker with a valid id must be provided.');
    if (this.entries.has(tracker.id)) {
      throw new Error(`Tracker "${tracker.id}" is already registered.`);
    }

    const entry: TrackerEntry = {
      tracker,
      enabled: config.enabled ?? DEFAULTS.trackerEnabled,
      timeoutMs: Math.max(0, config.timeoutMs ?? DEFAULTS.trackerTimeoutMs),
      include: config.include,
      exclude: config.exclude,
    };

    this.entries.set(tracker.id, entry);
    this.entriesList = Array.from(this.entries.values());

    if (entry.enabled && tracker.initialize) {
      entry.initialization = this.initTracker(entry);
      return entry.initialization;
    }
  }

  async enable(trackerId: string): Promise<void> {
    const entry = this.getRequired(trackerId);
    entry.enabled = true;
    if (!entry.initialization && entry.tracker.initialize) {
      entry.initialization = this.initTracker(entry);
      await entry.initialization;
    }
  }

  disable(trackerId: string): void {
    this.getRequired(trackerId).enabled = false;
  }

  configure(trackerId: string, config: TrackerRuntimeConfig): void {
    const entry = this.getRequired(trackerId);
    if (config.timeoutMs !== undefined) entry.timeoutMs = Math.max(0, config.timeoutMs);
    if (config.include !== undefined) entry.include = config.include;
    if (config.exclude !== undefined) entry.exclude = config.exclude;
  }

  getEntries(): readonly TrackerEntry[] {
    return this.entriesList;
  }

  async flush(): Promise<void> {
    const tasks = this.entriesList
      .filter((e) => e.enabled && e.tracker.flush)
      .map(async (e) => {
        try {
          await withTimeout(() => e.tracker.flush?.(), e.timeoutMs, e.tracker.id, TRACKER_OPERATION.FLUSH);
        } catch (error) {
          this.errors.report(error, e.tracker.id, TRACKER_OPERATION.FLUSH);
        }
      });
    await Promise.all(tasks);
  }

  async destroyAll(): Promise<void> {
    const entries = this.entriesList;
    this.entries.clear();
    this.entriesList = [];
    await Promise.all(entries.map((entry) => this.destroyEntry(entry)));
  }

  async checkHealth(): Promise<readonly TrackerHealthResult[]> {
    return Promise.all(
      this.entriesList.map(async (entry): Promise<TrackerHealthResult> => {
        const id = entry.tracker.id;
        if (!entry.enabled) return { id, healthy: false, message: 'Tracker is disabled' };
        if (!entry.tracker.healthCheck) return { id, healthy: true };

        try {
          const res = await withTimeout(() => entry.tracker.healthCheck!(), entry.timeoutMs, id, TRACKER_OPERATION.HEALTH_CHECK);
          return typeof res === 'boolean'
            ? { id, healthy: res }
            : { id, healthy: res.healthy, ...(res.message ? { message: res.message } : {}) };
        } catch (error) {
          this.errors.report(error, id, TRACKER_OPERATION.HEALTH_CHECK);
          return { id, healthy: false, message: error instanceof Error ? error.message : String(error) };
        }
      }),
    );
  }

  private async destroyEntry(entry: TrackerEntry): Promise<void> {
    entry.enabled = false;
    if (!entry.tracker.destroy) return;
    try {
      await withTimeout(() => entry.tracker.destroy?.(), entry.timeoutMs, entry.tracker.id, TRACKER_OPERATION.DESTROY);
    } catch (error) {
      this.errors.report(error, entry.tracker.id, TRACKER_OPERATION.DESTROY);
    }
  }

  private async initTracker(entry: TrackerEntry): Promise<void> {
    try {
      await withTimeout(() => entry.tracker.initialize?.(), entry.timeoutMs, entry.tracker.id, TRACKER_OPERATION.INITIALIZE);
    } catch (error) {
      this.errors.report(error, entry.tracker.id, TRACKER_OPERATION.INITIALIZE);
      throw error;
    }
  }

  private getRequired(id: string): TrackerEntry {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Tracker "${id}" is not registered.`);
    return entry;
  }
}
