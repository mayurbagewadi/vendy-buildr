import { PaymentGatewayCredentials, PaymentMethod } from './types';

export const getAvailablePaymentMethods = (
  credentials: PaymentGatewayCredentials,
  paymentMode: 'online_only' | 'online_and_cod'
): PaymentMethod[] => {
  const methods: PaymentMethod[] = [];

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
