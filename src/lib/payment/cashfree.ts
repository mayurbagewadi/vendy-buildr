// Cashfree payment gateway integration

import { OrderDetails, PaymentCallbacks, PaymentResult } from './types';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    Cashfree: any;
  }
}

/**
 * Load Cashfree SDK script
 */
export const loadCashfreeScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Cashfree) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/**
 * Create Cashfree order
 */
export const createCashfreeOrder = async (
  orderDetails: OrderDetails,
  storeId: string
): Promise<{ orderId: string; sessionId: string; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('create-cashfree-order', {
      body: {
        amount: orderDetails.amount,
        currency: orderDetails.currency,
        orderId: orderDetails.orderNumber,
        customerName: orderDetails.customerName,
        customerPhone: orderDetails.customerPhone,
        customerEmail: orderDetails.customerEmail || '',
        storeId,
      },
    });

    if (error) throw error;

    return {
      orderId: data.order_id,
      sessionId: data.payment_session_id,
    };
  } catch (error: any) {
    console.error('Error creating Cashfree order:', error);
    return { orderId: '', sessionId: '', error: error.message };
  }
};

/**
 * Open Cashfree checkout
 */
export const openCashfreeCheckout = async (
  sessionId: string,
  callbacks: PaymentCallbacks
): Promise<PaymentResult> => {
  try {
    const loaded = await loadCashfreeScript();
    if (!loaded) {
      return { success: false, error: 'Failed to load Cashfree SDK' };
    }

    const cashfree = window.Cashfree({
      mode: 'production', // Change to 'sandbox' for testing
    });

    const checkoutOptions = {
      paymentSessionId: sessionId,
      redirectTarget: '_modal',
    };

    cashfree.checkout(checkoutOptions).then((result: any) => {
      if (result.error) {
        callbacks.onFailure(result.error);
      }
      if (result.redirect) {
        // Payment completed, verify on backend
        callbacks.onSuccess(result);
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error('Cashfree checkout error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Verify Cashfree payment
 */
export const verifyCashfreePayment = async (
  orderId: string,
  storeId: string
): Promise<{ verified: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('verify-cashfree-payment', {
      body: { orderId, storeId },
    });

    if (error) throw error;

    return { verified: data.verified };
  } catch (error: any) {
    console.error('Error verifying Cashfree payment:', error);
    return { verified: false, error: error.message };
  }
};
