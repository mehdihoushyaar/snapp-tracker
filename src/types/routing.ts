import type { EventName } from './events';

export type RouteTarget = '*' | readonly string[];

export interface RoutingOptions<Events extends object = any> {
  readonly defaultTarget?: RouteTarget;
  readonly topics?: Readonly<Partial<Record<EventName<Events> | `${string}:*` | `*:${string}` | '*', RouteTarget>>>;
}
