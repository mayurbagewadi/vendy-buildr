// Razorpay payment gateway integration

import { OrderDetails, PaymentCallbacks, PaymentResult } from './types';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = false;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
};

export const createRazorpayOrder = async (
  cartItems: { productId: string; quantity: number; variant?: string }[],
  currency: string,
  storeId: string,
  couponCode?: string,
  autoDiscountId?: string,
  orderRecord?: Record<string, any>
): Promise<{ orderId: string; dbOrderId: string; verifiedTotal: number; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
      body: {
        storeId,
        cartItems,
        currency,
        couponCode: couponCode || undefined,
        autoDiscountId: autoDiscountId || undefined,
        orderRecord,
      },
    });

    if (error) throw error;

    if (!data.success) {
      return { orderId: '', dbOrderId: '', verifiedTotal: 0, error: data.error || 'Failed to create order' };
    }

    if (!data.orderId || !data.orderId.startsWith('order_')) {
      console.error('Invalid Razorpay order ID:', data.orderId);
      return { orderId: '', dbOrderId: '', verifiedTotal: 0, error: 'Invalid order ID format' };
    }

    if (!data.dbOrderId) {
      console.error('Missing DB order ID from Razorpay order response');
      return { orderId: '', dbOrderId: '', verifiedTotal: 0, error: 'Could not start payment. Please try again.' };
    }

    console.log('Razorpay order created:', data.orderId, '| verified total:', data.verifiedTotal);
    return { orderId: data.orderId, dbOrderId: data.dbOrderId, verifiedTotal: data.verifiedTotal };
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    return { orderId: '', dbOrderId: '', verifiedTotal: 0, error: error.message || 'Failed to create order' };
  }
};

export const openRazorpayCheckout = async (
  orderDetails: OrderDetails,
  credentials: { key_id: string },
  callbacks: PaymentCallbacks
): Promise<PaymentResult> => {
  try {
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      return {
        success: false,
        error: 'Failed to load Razorpay SDK',
      };
    }

    if (!orderDetails.orderId || !orderDetails.orderId.startsWith('order_')) {
      console.error('Invalid Razorpay Order ID format:', orderDetails.orderId);
      return {
        success: false,
        error: 'Invalid Order ID. Please try again.',
      };
    }

    console.log('Opening Razorpay with order_id:', orderDetails.orderId);

    const options = {
      key: credentials.key_id,
      amount: Math.round(orderDetails.amount * 100),
      currency: orderDetails.currency,
      name: 'Your Store Name',
      description: `Order #${orderDetails.orderNumber}`,
      order_id: String(orderDetails.orderId),
      prefill: {
        name: orderDetails.customerName,
        email: orderDetails.customerEmail || '',
        contact: orderDetails.customerPhone,
      },
      theme: {
        color: '#3b82f6',
      },
      handler: function (response: any) {
        console.log('Razorpay handler response:', response);
        callbacks.onSuccess(response);
      },
      modal: {
        ondismiss: function () {
          if (callbacks.onDismiss) {
            callbacks.onDismiss();
          }
        },
      },
    };

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

export const verifyRazorpayPayment = async (
  orderId: string,
  paymentId: string,
  signature: string,
  storeId: string,
  dbOrderId?: string
): Promise<{ verified: boolean; orderId?: string; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('verify-razorpay-payment', {
      body: {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        storeId,
        dbOrderId,
      },
    });

    if (error) throw error;

    return { verified: data.verified, orderId: data.orderId };
  } catch (error: any) {
    console.error('Error verifying Razorpay payment:', error);
    return { verified: false, error: error.message };
  }
};

export const markRazorpayPaymentFailed = async (
  storeId: string,
  dbOrderId: string,
  reason: string,
  failureDetails?: Record<string, any>,
  razorpayOrderId?: string
): Promise<{ success: boolean; markedFailed?: boolean; error?: string }> => {
  try {
    console.log('Marking Razorpay payment failed:', {
      storeId,
      dbOrderId,
      reason,
      razorpayOrderId,
      failureDetails,
    });

    const { data, error } = await supabase.functions.invoke('verify-razorpay-payment', {
      body: {
        action: 'mark_failed',
        storeId,
        dbOrderId,
        reason,
        failureDetails,
        razorpay_order_id: razorpayOrderId,
      },
    });

    if (error) throw error;

    console.log('Razorpay payment failed marker response:', data);

    return { success: Boolean(data?.success), markedFailed: data?.markedFailed };
  } catch (error: any) {
    console.error('Error marking Razorpay payment failed:', error);
    return { success: false, error: error.message };
  }
};
