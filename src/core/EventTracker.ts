import { ErrorHandler } from '../errors/ErrorHandler';
import { EventRouter } from '../routing/EventRouter';
import { EventSender } from './EventSender';
import { TrackerManager } from './TrackerManager';
import type {
  EventTracker,
  InitTrackerOptions,
  TrackReport,
  TrackerHealthResult,
} from '../types/core';
import type { EventName, TrackingEvent } from '../types/events';
import type { TrackerRuntimeConfig } from '../types/tracker';

class EventTrackerClient<Events extends object> implements EventTracker<Events> {
  readonly ready: Promise<void>;

  private readonly trackers: TrackerManager;
  private readonly router: EventRouter;
  private readonly sender: EventSender;
  private destroyed = false;

  constructor(options: InitTrackerOptions<Events> = {}) {
    const trackerConfigs = options.trackers ?? [];
    const ids = trackerConfigs.map((t) => t.tracker?.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error('Tracker IDs must be unique.');
    }

    const errors = new ErrorHandler(options.onError);
    this.trackers = new TrackerManager(errors);
    this.router = new EventRouter(options.routing);
    this.sender = new EventSender(errors);

    this.ready = Promise.allSettled(
      trackerConfigs.map((config) => this.trackers.register(config)),
    ).then(() => undefined);
  }

  async track<Topic extends EventName<Events>>(
    topic: Topic,
    payload: Events[Topic],
  ): Promise<TrackReport> {
    this.assertOpen();
    await this.ready;
    this.assertOpen();

    const event: TrackingEvent<string, Events[Topic]> = Object.freeze({
      topic,
      payload,
      timestamp: Date.now(),
    });
    const decisions = this.router.resolve(topic, this.trackers.getEntries());
    return this.sender.send(event, decisions);
  }

  scope<ScopedEvents extends object>(): EventTracker<ScopedEvents> {
    return this as unknown as EventTracker<ScopedEvents>;
  }

  enable(trackerId: string): Promise<void> {
    this.assertOpen();
    return this.trackers.enable(trackerId);
  }

  disable(trackerId: string): void {
    this.assertOpen();
    this.trackers.disable(trackerId);
  }

  configureTracker(trackerId: string, config: TrackerRuntimeConfig<Events>): void {
    this.assertOpen();
    this.trackers.configure(trackerId, config);
  }

  checkHealth(): Promise<readonly TrackerHealthResult[]> {
    this.assertOpen();
    return this.trackers.checkHealth();
  }

  flush(): Promise<void> {
    this.assertOpen();
    return this.trackers.flush();
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    await this.ready;
    await this.trackers.destroyAll();
  }

  private assertOpen(): void {
    if (this.destroyed) throw new Error('Tracker has been destroyed.');
  }
}

export function initTracker<Events extends object = Record<string, object>>(
  options: InitTrackerOptions<Events> = {},
): EventTracker<Events> {
  return new EventTrackerClient<Events>(options);
}

export const createTracker = initTracker;
