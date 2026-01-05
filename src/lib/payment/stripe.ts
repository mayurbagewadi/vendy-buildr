// Stripe payment gateway integration

import { OrderDetails, PaymentCallbacks, PaymentResult } from './types';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    Stripe: any;
  }
}

/**
 * Load Stripe SDK script
 */
export const loadStripeScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Stripe) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/**
 * Create Stripe payment intent
 */
export const createStripePaymentIntent = async (
  orderDetails: OrderDetails,
  storeId: string
): Promise<{ clientSecret: string; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('create-stripe-payment', {
      body: {
        amount: Math.round(orderDetails.amount * 100), // Convert to cents
        currency: orderDetails.currency.toLowerCase(),
        orderId: orderDetails.orderNumber,
        customerName: orderDetails.customerName,
        customerEmail: orderDetails.customerEmail || '',
        storeId,
      },
    });

    if (error) throw error;

    return { clientSecret: data.clientSecret };
  } catch (error: any) {
    console.error('Error creating Stripe payment:', error);
    return { clientSecret: '', error: error.message };
  }
};

/**
 * Open Stripe checkout
 */
export const openStripeCheckout = async (
  clientSecret: string,
  publishableKey: string,
  callbacks: PaymentCallbacks
): Promise<PaymentResult> => {
  try {
    const loaded = await loadStripeScript();
    if (!loaded) {
      return { success: false, error: 'Failed to load Stripe SDK' };
    }

    const stripe = window.Stripe(publishableKey);

    // Redirect to Stripe checkout or use Elements
    const { error } = await stripe.confirmPayment({
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/payment/stripe/callback`,
      },
    });

    if (error) {
      callbacks.onFailure(error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Verify Stripe payment
 */
export const verifyStripePayment = async (
  paymentIntentId: string,
  storeId: string
): Promise<{ verified: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('verify-stripe-payment', {
      body: {
        paymentIntentId,
        storeId,
      },
    });

    if (error) throw error;

    return { verified: data.verified };
  } catch (error: any) {
    console.error('Error verifying Stripe payment:', error);
    return { verified: false, error: error.message };
  }
};
