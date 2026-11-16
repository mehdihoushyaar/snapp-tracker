import type { AppTrackingEvent, EventName } from './events';

export interface TrackerHealth {
  readonly healthy: boolean;
  readonly message?: string;
}

export interface Tracker<Events extends object = any> {
  readonly id: string;
  initialize?(): void | Promise<void>;
  track(event: AppTrackingEvent<Events>): void | Promise<void>;
  flush?(): void | Promise<void>;
  destroy?(): void | Promise<void>;
  healthCheck?(): Promise<boolean | TrackerHealth> | boolean | TrackerHealth;
}

export interface TrackerConfig<Events extends object = any> {
  readonly tracker: Tracker<Events>;
  readonly enabled?: boolean;
  readonly include?: readonly (EventName<Events> | `${string}:*` | `*:${string}` | '*')[];
  readonly exclude?: readonly (EventName<Events> | `${string}:*` | `*:${string}` | '*')[];
  readonly timeoutMs?: number;
}

export interface TrackerRuntimeConfig<Events extends object = any> {
  readonly include?: readonly (EventName<Events> | `${string}:*` | `*:${string}` | '*')[];
  readonly exclude?: readonly (EventName<Events> | `${string}:*` | `*:${string}` | '*')[];
  readonly timeoutMs?: number;
}
