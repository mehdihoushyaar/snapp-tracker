import { initTracker } from '../src';
import type { AppEvents, CheckoutEvents, InteractionEvents } from './events';
import { SentryTracker, GtmTracker, CustomServiceTracker } from './adapters';

export const tracker = initTracker<AppEvents>({
  trackers: [
    {
      tracker: new SentryTracker(),
      enabled: true,
      include: ['payment:*', 'checkout:*'],
    },
    {
      tracker: new GtmTracker('GTM-12345'),
      enabled: false,
      exclude: ['payment:failed'],
    },
    {
      tracker: new CustomServiceTracker('https://telemetry.example.com/events'),
      enabled: true,
      timeoutMs: 3000,
    },
  ],
  routing: {
    defaultTarget: '*',
    topics: {
      'page:*': ['gtm', 'custom'],
      'ui:*': ['gtm', 'custom'],
      'checkout:*': ['gtm', 'custom'],
      'payment:*': ['sentry', 'custom'],
    },
  },
  onError(error, context) {
    console.error(`Tracker [${context.trackerId}] error during ${context.operation}:`, error);
  },
});

export const checkoutTracker = tracker.scope<CheckoutEvents>();
export const interactionTracker = tracker.scope<InteractionEvents>();

export async function onPageLoad(path: string, referrer?: string) {
  await tracker.track('page:viewed', {
    path,
    ...(referrer ? { referrer } : {}),
  });
}

export async function onButtonClick(buttonId: string, buttonText: string) {
  await interactionTracker.track('ui:button_clicked', {
    buttonId,
    buttonText,
  });
}

export async function onCheckoutSubmit(cartId: string, amount: number) {
  await checkoutTracker.track('checkout:started', {
    cartId,
    amount,
    currency: 'USD',
  });
}

export async function onPaymentFailed(orderId: string, reason: string) {
  await tracker.track('payment:failed', {
    orderId,
    reason,
    code: 'GATEWAY_ERROR',
  });
}

export async function runExample() {
  await tracker.ready;

  const healthReport = await tracker.checkHealth();
  console.log('Health report:', healthReport);

  await onPageLoad('/checkout', 'https://example.com');

  await onButtonClick('btn-consent', 'Accept Cookies');
  await tracker.enable('gtm');

  await onButtonClick('btn-checkout', 'Complete Order');
  await onCheckoutSubmit('cart_101', 120);

  await onPaymentFailed('ord_202', 'Insufficient funds');

  tracker.configureTracker('gtm', {
    exclude: ['payment:*'],
  });

  await tracker.flush();

  await tracker.destroy();
}

runExample().catch(console.error);
