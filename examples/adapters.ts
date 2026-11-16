import type { Tracker, TrackingEvent, AppTrackingEvent, TrackerHealth } from '../src';
import type { AppEvents } from './events';

export class SentryTracker implements Tracker<AppEvents> {
  readonly id = 'sentry';

  track(event: AppTrackingEvent<AppEvents>): void {
    if (event.topic === 'payment:failed') {
      console.error(`[Sentry Error] Payment failed: ${event.payload.reason} (code: ${event.payload.code})`);
    } else {
      console.log(`[Sentry Breadcrumb] ${event.topic}:`, event.payload);
    }
  }

  healthCheck(): TrackerHealth {
    return { healthy: true, message: 'Sentry client connected' };
  }
}

export class GtmTracker implements Tracker<AppEvents> {
  readonly id = 'gtm';

  constructor(private readonly containerId: string) {}

  async initialize(): Promise<void> {
    console.log(`[GTM] Container ${this.containerId} loaded`);
  }

  track(event: TrackingEvent): void {
    console.log(`[GTM dataLayer.push] topic: ${event.topic}`, event.payload);
  }

  healthCheck(): boolean {
    return true;
  }
}

export class CustomServiceTracker implements Tracker<AppEvents> {
  readonly id = 'custom';
  private buffer: TrackingEvent[] = [];

  constructor(private readonly endpoint: string) {}

  track(event: AppTrackingEvent<AppEvents>): void {
    this.buffer.push(event);
    console.log(`[CustomService] Buffered: ${event.topic} (queue length: ${this.buffer.length})`);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = [...this.buffer];
    this.buffer = [];
    console.log(`[CustomService] Flushed ${batch.length} events to ${this.endpoint}`);
  }

  async healthCheck(): Promise<TrackerHealth> {
    return { healthy: true, message: 'Telemetry gateway reachable' };
  }

  async destroy(): Promise<void> {
    await this.flush();
    console.log('[CustomService] Connection closed');
  }
}
