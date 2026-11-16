# snapp-tracker

**This is an event tracking engine engineered to scale and grow effortlessly alongside large-scale applications and enterprise frontend architectures.**

A lightweight, zero-dependency TypeScript core designed to distribute application telemetry across multiple tracking destinations (e.g. Sentry, Google Tag Manager, custom HTTP backends) with zero vendor lock-in, strict type safety, and fault isolation.

> [!NOTE]
> - **Examples Attached to Root**: Practical reference patterns and workflows are available in the [`examples/`](./examples) directory at the project root.
> - **Consumer-Level Adapters**: Tracker adapters are implemented and added entirely at the consumer level. The tracker engine is fully blind to how consumers handle dispatched events or what destinations they integrate with.

---

## Key Highlights

- **Scale & Grow Ready**: Engineered for large codebases with 1,000+ events. Employs direct TypeScript property indexing (`Events[Topic]`) to eliminate union depth bottlenecks (`TS2590`).
- **Benchmark Performance**: Allocation-free broadcast fast paths, cached provider lists, and direct $O(1)$ dictionary lookups ensure zero garbage collection pressure on the browser main thread.
- **Strict 2-Argument Public API**: Calls enforce `tracker.track(topic, payload)`—no third argument, no provider leak, no messy inline options.
- **Zero Vendor Lock-in**: The core is 100% decoupled from third-party SDKs. You plug in lightweight adapters; the core manages routing, execution, timeouts, and error barriers.
- **Fault-Tolerant by Design**: Isolated execution prevents a failing, slow, or hanging provider from blocking others or crashing user interactions.
- **Domain Scoping**: Teams and microfrontends can narrow the tracker to their own event catalog using `tracker.scope<DomainEvents>()` with zero runtime overhead.

---

## Design Patterns

| Pattern                         | Implementation                 | Purpose                                                                                               |
| :------------------------------ | :----------------------------- | :---------------------------------------------------------------------------------------------------- |
| **Facade**                      | `initTracker` / `EventTracker` | Provides a single, clean API concealing routing, timeouts, health checks, and dispatching.            |
| **Adapter**                     | `Tracker` interface            | Standardizes diverse targets (error loggers, tag managers, batching gateways) into uniform instances. |
| **Strategy & Pattern Routing**  | `EventRouter`                  | Decouples event dispatching from destination targets with direct matching and wildcard patterns.      |
| **Observer / Pub-Sub**          | `EventSender`                  | Broadcasts tracking events to registered destinations without tight coupling.                         |
| **Circuit / Timeout Isolation** | `withTimeout` & `ErrorHandler` | Protects against network freezes and SDK exceptions with isolated race timers and error boundaries.   |
| **Scoped Builder**              | `tracker.scope<T>()`           | Provides type-safe domain sub-trackers for modular teams and microfrontends.                          |

---

## The Core Rule

Every event track invocation strictly takes exactly two arguments:

```ts
tracker.track(topic, payload);
```

```ts
// Valid
await tracker.track("checkout:started", {
  cartId: "cart_101",
  amount: 250,
  currency: "USD",
});

// Invalid - will not compile:
// tracker.track('checkout:started', payload, { sendTo: 'gtm' });
```

Routing rules, filters, timeouts, and provider setups belong in initialization configuration—never scattered across UI component click handlers.

---

## Installation & Verification

```bash
npm install
npm run check
```

---

## Quick Start

### 1. Define your Event Catalog

Define your event map with topics as keys and payloads as typed values:

```ts
// events.ts
export interface AppEvents {
  "page:viewed": {
    path: string;
    referrer?: string;
  };
  "ui:button_clicked": {
    buttonId: string;
    buttonText: string;
  };
  "checkout:started": {
    cartId: string;
    amount: number;
    currency: "USD" | "EUR" | "IRR";
  };
  "payment:failed": {
    orderId: string;
    reason: string;
    code: string;
  };
}
```

### 2. Implement Simple Adapters

Adapters implement the universal `Tracker` interface. State (API keys, batch queues, SDK instances) stays encapsulated inside the adapter:

```ts
// adapters.ts
import type { Tracker, AppTrackingEvent, TrackerHealth } from "snapp-tracker";
import type { AppEvents } from "./events";

export class SentryTracker implements Tracker<AppEvents> {
  readonly id = "sentry";

  track(event: AppTrackingEvent<AppEvents>): void {
    if (event.topic === "payment:failed") {
      console.error(`[Sentry Error]`, event.payload);
    } else {
      console.log(`[Sentry Breadcrumb] ${event.topic}:`, event.payload);
    }
  }

  healthCheck(): TrackerHealth {
    return { healthy: true, message: "Sentry client operational" };
  }
}

export class GtmTracker implements Tracker<AppEvents> {
  readonly id = "gtm";

  constructor(private readonly containerId: string) {}

  async initialize(): Promise<void> {
    console.log(`[GTM] Container ${this.containerId} loaded`);
  }

  track(event: AppTrackingEvent<AppEvents>): void {
    console.log(`[GTM dataLayer] ${event.topic}:`, event.payload);
  }

  healthCheck(): boolean {
    return true;
  }
}
```

### 3. Initialize the Engine

```ts
// tracker.ts
import { initTracker } from "snapp-tracker";
import type { AppEvents } from "./events";
import { SentryTracker, GtmTracker } from "./adapters";

export const tracker = initTracker<AppEvents>({
  trackers: [
    {
      tracker: new SentryTracker(),
      enabled: true,
      include: ["payment:*", "checkout:*"],
    },
    {
      tracker: new GtmTracker("GTM-12345"),
      enabled: false, // will activate upon user cookie consent
      exclude: ["payment:failed"],
    },
  ],
  routing: {
    defaultTarget: "*",
    topics: {
      "page:*": ["gtm"],
      "ui:*": ["gtm"],
      "payment:*": ["sentry"],
    },
  },
  onError(error, context) {
    console.error(
      `Provider [${context.trackerId}] failed during ${context.operation}:`,
      error,
    );
  },
});
```

---

## Features & Usage

### 1. Pattern & Wildcard Routing

Configure routing once during initialization using exact topics or pattern wildcards:

```ts
routing: {
  defaultTarget: '*', // Fallback for unmatched topics
  topics: {
    'page:*': ['gtm'],              // Prefix match: page:viewed, page:scrolled
    '*:secret': [],                 // Suffix match: drop sensitive events
    'checkout:completed': ['gtm'],   // Exact match takes precedence
    'order:*_confirmed': ['custom'],// Infix match
  },
}
```

- Direct topic lookups execute in $O(1)$ dictionary time.
- Pattern matching uses lightweight string slices with zero regex compilation overhead.
- Unknown destination IDs return structured `'not-registered'` skip results without throwing.

### 2. Domain Scoping for Large Teams

When multiple feature teams (e.g. Auth, Checkout, Catalog) work within a monorepo or microfrontend architecture, avoid sharing the entire 1,000-event catalog. Use `tracker.scope<T>()` to restrict autocomplete and validation to their specific slice:

```ts
export interface CheckoutEvents {
  "checkout:started": { cartId: string; amount: number; currency: string };
  "checkout:completed": { orderId: string; amount: number };
}

// Zero-runtime-cost type projection:
export const checkoutTracker = tracker.scope<CheckoutEvents>();

// Feature code has strict autocomplete and type checks for checkout events only:
await checkoutTracker.track("checkout:started", {
  cartId: "cart_101",
  amount: 150,
  currency: "USD",
});
```

### 3. Dynamic Consent & Runtime Controls

Enable, disable, or adjust provider configurations dynamically (e.g. after user grants cookie consent):

```ts
// User accepts cookies: initialize and enable GTM
await tracker.enable("gtm");

// Disable a provider immediately
tracker.disable("sentry");

// Update filters or timeouts at runtime
tracker.configureTracker("gtm", {
  exclude: ["payment:*"],
  timeoutMs: 5000,
});
```

### 4. Health Checks

Instead of continuous polling loops or heavy background state machines, query the health of all registered providers on-demand:

```ts
const healthReport = await tracker.checkHealth();
// [
//   { id: 'sentry', healthy: true, message: 'Sentry client operational' },
//   { id: 'gtm', healthy: false, message: 'Tracker is disabled' }
// ]
```

Health checks execute concurrently, guarded by timeout limits and error isolation.

### 5. Timeout Protection & Error Isolation

Each tracker execution is isolated. If a tracking provider hangs or throws:

- The execution times out (defaults to 10s, configurable via `timeoutMs`).
- The failure is isolated and returned as `{ status: 'failed', error }` in the dispatch report.
- The failure is safely forwarded to `onError` without interrupting other providers or the user flow.

```ts
const report = await tracker.track("page:viewed", { path: "/home" });

for (const result of report.results) {
  console.log(result.trackerId, result.status, result.durationMs);
  // 'sentry'  -> 'success' (2ms)
  // 'gtm'     -> 'skipped' (reason: 'disabled')
}
```

### 6. Flush & Graceful Shutdown

For page transitions, window unload events, or process termination:

```ts
// Flush in-memory queues or network buffers across active providers
await tracker.flush();

// Gracefully destroy connections and release resources
await tracker.destroy();
```

---

## Benchmark & Performance Architecture

1. **Direct Indexing vs Union Depth**:
   Instead of distributing an event union across function parameters (`Topic extends keyof Events ? ... : never`), the core resolves `payload: Events[Topic]` through direct property indexing. This allows catalogs to scale past 1,000+ distinct event types without triggering TypeScript compiler recursion limits (`TS2590`).

2. **Zero-Allocation Broadcast**:
   90%+ of application events target the default broadcast route (`*`). When `target === '*'`, `EventRouter` bypasses all `Set` and `Map` allocations.

3. **Cached Provider Entries**:
   `TrackerManager` caches the provider array internally. Calling `tracker.track()` executes against the pre-allocated slice without running `Array.from()` per event.

4. **Regex-Free Pattern Matching**:
   Wildcard matching relies entirely on lightweight string prefix and suffix comparisons, eliminating dynamic `RegExp` instantiation and execution overhead on hot event loops.

---

## Directory Structure

```text
src/
├── constants/
│   ├── defaults.ts          # Default settings (timeouts, defaultRoute: '*')
│   ├── errors.ts            # Error codes (TRACKER_TIMEOUT)
│   └── tracker.ts           # Standard operations (track, flush, destroy, etc.)
├── core/
│   ├── EventSender.ts       # Concurrent dispatching with timeout isolation
│   ├── EventTracker.ts      # Public facade, ready lifecycle, domain scoping
│   └── TrackerManager.ts    # Cached provider entries, runtime controls, health
├── errors/
│   ├── ErrorHandler.ts      # Isolated consumer error reporting
│   └── TrackerTimeoutError.ts # Structured timeout error
├── routing/
│   └── EventRouter.ts       # O(1) direct and pattern wildcard routing
├── types/
│   ├── core.ts              # Engine options, dispatch results, health types
│   ├── events.ts            # Type-safe event dictionary & payload mapping
│   ├── routing.ts           # Routing configuration contracts
│   ├── tracker.ts           # Universal Tracker interface & runtime config
│   └── index.ts             # Public type re-exports
├── utils/
│   └── withTimeout.ts       # High-performance async timeout race
└── index.ts                 # Main library entry point
```

---

## Examples

Check the `examples/` directory for ready-to-use patterns:

- [`examples/events.ts`](./examples/events.ts): Multi-domain event catalog (Auth, Navigation, UI Interactions, Checkout).
- [`examples/adapters.ts`](./examples/adapters.ts): Production-style Sentry, GTM, and custom batching implementations.
- [`examples/ui-flow.ts`](./examples/ui-flow.ts): Comprehensive UI flow demonstrating page loads, scoped trackers, consent toggling, health checks, flushing, and destruction.
