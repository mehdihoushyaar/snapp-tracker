export interface AuthEvents {
  'auth:signed_in': {
    userId: string;
    method: 'password' | 'oauth';
  };
  'auth:signed_out': {
    userId: string;
  };
}

export interface NavigationEvents {
  'page:viewed': {
    path: string;
    title?: string;
    referrer?: string;
  };
}

export interface InteractionEvents {
  'ui:button_clicked': {
    buttonId: string;
    buttonText: string;
  };
  'ui:modal_opened': {
    modalId: string;
  };
}

export interface CheckoutEvents {
  'checkout:started': {
    cartId: string;
    amount: number;
    currency: 'USD' | 'EUR' | 'IRR';
  };
  'checkout:completed': {
    orderId: string;
    amount: number;
    currency: 'USD' | 'EUR' | 'IRR';
  };
  'payment:failed': {
    orderId: string;
    reason: string;
    code: string;
  };
}

export type AppEvents = AuthEvents & NavigationEvents & InteractionEvents & CheckoutEvents;
