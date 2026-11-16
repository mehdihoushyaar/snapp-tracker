import type { EventName } from './events';
import type { RoutingOptions } from './routing';
import type {
  TrackerConfig,
  TrackerRuntimeConfig,
} from './tracker';

export interface TrackerErrorContext {
  readonly trackerId: string;
  readonly operation: 'initialize' | 'track' | 'flush' | 'destroy' | 'healthCheck';
  readonly topic?: string;
  readonly timestamp: number;
}

export type DispatchStatus = 'success' | 'failed' | 'skipped';

export type SkipReason =
  | 'not-routed'
  | 'not-registered'
  | 'disabled'
  | 'event-filtered';

export interface DispatchResult {
  readonly trackerId: string;
  readonly status: DispatchStatus;
  readonly durationMs: number;
  readonly reason?: SkipReason;
  readonly error?: unknown;
}

export interface TrackReport {
  readonly topic: string;
  readonly timestamp: number;
  readonly results: readonly DispatchResult[];
}

export interface TrackerHealthResult {
  readonly id: string;
  readonly healthy: boolean;
  readonly message?: string;
}

export interface InitTrackerOptions<Events extends object = any> {
  readonly trackers?: readonly TrackerConfig<Events>[];
  readonly routing?: RoutingOptions<Events>;
  readonly onError?: (error: unknown, context: TrackerErrorContext) => void;
}

export interface EventTracker<Events extends object> {
  readonly ready: Promise<void>;

  track<Topic extends EventName<Events>>(
    topic: Topic,
    payload: Events[Topic],
  ): Promise<TrackReport>;

  scope<ScopedEvents extends object>(): EventTracker<ScopedEvents>;

  enable(trackerId: string): Promise<void>;
  disable(trackerId: string): void;
  configureTracker(trackerId: string, config: TrackerRuntimeConfig<Events>): void;

  checkHealth(): Promise<readonly TrackerHealthResult[]>;
  flush(): Promise<void>;
  destroy(): Promise<void>;
}
