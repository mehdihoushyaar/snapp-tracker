import { DEFAULTS } from '../constants/defaults';
import type { RoutingOptions, SkipReason } from '../types';
import type { TrackerEntry } from '../core/TrackerManager';

export interface RouteDecision {
  readonly trackerId: string;
  readonly entry?: TrackerEntry;
  readonly skipReason?: SkipReason;
}

export function matchTopic(pattern: string, topic: string): boolean {
  if (pattern === '*' || pattern === topic) return true;
  if (!pattern.includes('*')) return false;
  if (pattern.endsWith('*')) return topic.startsWith(pattern.slice(0, -1));
  if (pattern.startsWith('*')) return topic.endsWith(pattern.slice(1));
  const [prefix, suffix] = pattern.split('*');
  return topic.startsWith(prefix ?? '') && topic.endsWith(suffix ?? '');
}

export class EventRouter {
  private readonly defaultTarget: '*' | readonly string[];
  private readonly topics: Readonly<Partial<Record<string, '*' | readonly string[]>>>;

  constructor(options: RoutingOptions = {}) {
    this.defaultTarget = options.defaultTarget ?? DEFAULTS.defaultRoute;
    this.topics = options.topics ?? {};
  }

  resolve(topic: string, entries: readonly TrackerEntry[]): readonly RouteDecision[] {
    const target = this.getTarget(topic);
    const targetSet = target === '*' ? null : new Set(Array.isArray(target) ? target : [target]);

    const decisions: RouteDecision[] = entries.map((entry) => {
      const id = entry.tracker.id;
      if (targetSet && !targetSet.has(id)) return { trackerId: id, entry, skipReason: 'not-routed' };
      if (!entry.enabled) return { trackerId: id, entry, skipReason: 'disabled' };
      if (!this.isAllowed(entry, topic)) return { trackerId: id, entry, skipReason: 'event-filtered' };
      return { trackerId: id, entry };
    });

    if (targetSet) {
      for (const id of targetSet) {
        if (!entries.some((e) => e.tracker.id === id)) {
          decisions.push({ trackerId: id, skipReason: 'not-registered' });
        }
      }
    }

    return decisions;
  }

  private getTarget(topic: string): '*' | readonly string[] {
    const direct = this.topics[topic];
    if (direct !== undefined) return direct;
    for (const pattern in this.topics) {
      const target = this.topics[pattern];
      if (target && matchTopic(pattern, topic)) return target;
    }
    return this.defaultTarget;
  }

  private isAllowed(entry: TrackerEntry, topic: string): boolean {
    if (entry.include && !entry.include.some((p) => matchTopic(p, topic))) return false;
    if (entry.exclude && entry.exclude.some((p) => matchTopic(p, topic))) return false;
    return true;
  }
}
