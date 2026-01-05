// Payment gateway utilities - Main entry point

import { PaymentGatewayCredentials, PaymentMethod } from './types';

export * from './types';
export * from './razorpay';
export * from './phonepe';
export * from './cashfree';
export * from './payu';
export * from './paytm';
export * from './stripe';

/**
 * Get available payment methods based on store configuration
 */
export const getAvailablePaymentMethods = (
  credentials: PaymentGatewayCredentials,
  paymentMode: 'online_only' | 'online_and_cod'
): PaymentMethod[] => {
  const methods: PaymentMethod[] = [];

  // Add online payment gateways if enabled
  if (credentials.razorpay?.enabled && credentials.razorpay.key_id) {
    methods.push({
      id: 'razorpay',
      name: 'Razorpay',
      icon: '💳',
      color: 'bg-blue-500',
      enabled: true,
    });
  }

  if (credentials.phonepe?.enabled && credentials.phonepe.merchant_id) {
    methods.push({
      id: 'phonepe',
      name: 'PhonePe',
      icon: '📱',
      color: 'bg-purple-500',
      enabled: true,
    });
  }

  if (credentials.cashfree?.enabled && credentials.cashfree.app_id) {
    methods.push({
      id: 'cashfree',
      name: 'Cashfree',
      icon: '💰',
      color: 'bg-green-500',
      enabled: true,
    });
  }

  if (credentials.payu?.enabled && credentials.payu.merchant_key) {
    methods.push({
      id: 'payu',
      name: 'PayU',
      icon: '🔐',
      color: 'bg-orange-500',
      enabled: true,
    });
  }

  if (credentials.paytm?.enabled && credentials.paytm.merchant_id) {
    methods.push({
      id: 'paytm',
      name: 'Paytm',
      icon: '📲',
      color: 'bg-sky-500',
      enabled: true,
    });
  }

  if (credentials.stripe?.enabled && credentials.stripe.publishable_key) {
    methods.push({
      id: 'stripe',
      name: 'Stripe',
      icon: '💎',
      color: 'bg-indigo-500',
      enabled: true,
    });
  }

  // Add COD if allowed or if no online gateways are configured
  if (paymentMode === 'online_and_cod' || methods.length === 0) {
    methods.push({
      id: 'cod',
      name: 'Cash on Delivery',
      icon: '💵',
      color: 'bg-gray-500',
      enabled: true,
    });
  }

  return methods;
};

/**
 * Check if any online payment gateway is configured
 */
export const hasOnlinePaymentGateways = (credentials: PaymentGatewayCredentials): boolean => {
  return !!(
    (credentials.razorpay?.enabled && credentials.razorpay.key_id) ||
    (credentials.phonepe?.enabled && credentials.phonepe.merchant_id) ||
    (credentials.cashfree?.enabled && credentials.cashfree.app_id) ||
    (credentials.payu?.enabled && credentials.payu.merchant_key) ||
    (credentials.paytm?.enabled && credentials.paytm.merchant_id) ||
    (credentials.stripe?.enabled && credentials.stripe.publishable_key)
  );
};
