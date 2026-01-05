// Razorpay payment gateway integration

import { OrderDetails, PaymentCallbacks, PaymentResult } from './types';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    Razorpay: any;
  }
}

/**
 * Load Razorpay SDK script
 */
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    // Check if already loaded
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/**
 * Create Razorpay order via backend
 */
export const createRazorpayOrder = async (
  amount: number,
  currency: string,
  storeId: string
): Promise<{ orderId: string; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
      body: {
        amount: Math.round(amount * 100), // Convert to paise
        currency,
        storeId,
      },
    });

    if (error) throw error;

    return { orderId: data.id };
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    return { orderId: '', error: error.message || 'Failed to create order' };
  }
};

/**
 * Open Razorpay checkout modal
 */
export const openRazorpayCheckout = async (
  orderDetails: OrderDetails,
  credentials: { key_id: string },
  callbacks: PaymentCallbacks
): Promise<PaymentResult> => {
  try {
    // Load Razorpay script
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      return {
        success: false,
        error: 'Failed to load Razorpay SDK',
      };
    }

    // Configure Razorpay options
    const options = {
      key: credentials.key_id,
      amount: Math.round(orderDetails.amount * 100), // Convert to paise
      currency: orderDetails.currency,
      name: 'Your Store Name',
      description: `Order #${orderDetails.orderNumber}`,
      order_id: orderDetails.orderId,
      prefill: {
        name: orderDetails.customerName,
        email: orderDetails.customerEmail || '',
        contact: orderDetails.customerPhone,
      },
      theme: {
        color: '#3b82f6',
      },
      handler: function (response: any) {
        callbacks.onSuccess({
          paymentId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: function () {
          if (callbacks.onDismiss) {
            callbacks.onDismiss();
          }
        },
      },
    };

    // Open Razorpay checkout
    const razorpay = new window.Razorpay(options);

    razorpay.on('payment.failed', function (response: any) {
      callbacks.onFailure({
        code: response.error.code,
        description: response.error.description,
        reason: response.error.reason,
      });
    });

    razorpay.open();

    return { success: true };
  } catch (error: any) {
    console.error('Razorpay checkout error:', error);
    return {
      success: false,
      error: error.message || 'Payment failed',
    };
  }
};

/**
 * Verify Razorpay payment signature
 */
export const verifyRazorpayPayment = async (
  orderId: string,
  paymentId: string,
  signature: string,
  storeId: string
): Promise<{ verified: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('verify-razorpay-payment', {
      body: {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        storeId,
      },
    });

    if (error) throw error;

    return { verified: data.verified };
  } catch (error: any) {
    console.error('Error verifying Razorpay payment:', error);
    return { verified: false, error: error.message };
  }
};
