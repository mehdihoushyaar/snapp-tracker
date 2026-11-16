export type EventName<Events extends object> = Extract<keyof Events, string>;

export interface TrackingEvent<Topic extends string = string, Payload = unknown> {
  readonly topic: Topic;
  readonly payload: Readonly<Payload>;
  readonly timestamp: number;
}

export type AppTrackingEvent<Events extends object = Record<string, any>> = {
  [K in EventName<Events>]: TrackingEvent<K, Events[K]>;
}[EventName<Events>];
