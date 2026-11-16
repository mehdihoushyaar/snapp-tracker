import { TRACKER_OPERATION } from '../constants/tracker';
import type { DispatchResult, TrackReport } from '../types/core';
import type { TrackingEvent } from '../types/events';
import type { RouteDecision } from '../routing/EventRouter';
import type { ErrorHandler } from '../errors/ErrorHandler';
import { withTimeout } from '../utils/withTimeout';

export class EventSender {
  constructor(private readonly errors: ErrorHandler) {}

  async send(event: TrackingEvent, decisions: readonly RouteDecision[]): Promise<TrackReport> {
    const results = await Promise.all(
      decisions.map((decision) => this.sendToTracker(event, decision)),
    );

    return {
      topic: event.topic,
      timestamp: event.timestamp,
      results,
    };
  }

  private async sendToTracker(
    event: TrackingEvent,
    decision: RouteDecision,
  ): Promise<DispatchResult> {
    if (decision.skipReason || !decision.entry) {
      return {
        trackerId: decision.trackerId,
        status: 'skipped',
        reason: decision.skipReason ?? 'not-registered',
        durationMs: 0,
      };
    }

    const { entry } = decision;

    if (entry.initialization) {
      try {
        await entry.initialization;
      } catch {
        return {
          trackerId: entry.tracker.id,
          status: 'skipped',
          reason: 'disabled',
          durationMs: 0,
        };
      }
    }

    const startedAt = Date.now();

    try {
      await withTimeout(
        () => entry.tracker.track(event),
        entry.timeoutMs,
        entry.tracker.id,
        TRACKER_OPERATION.TRACK,
      );

      return {
        trackerId: entry.tracker.id,
        status: 'success',
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      this.errors.report(error, entry.tracker.id, TRACKER_OPERATION.TRACK, event.topic);

      return {
        trackerId: entry.tracker.id,
        status: 'failed',
        durationMs: Date.now() - startedAt,
        error,
      };
    }
  }
}
