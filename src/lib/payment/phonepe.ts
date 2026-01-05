// PhonePe payment gateway integration

import { OrderDetails, PaymentCallbacks, PaymentResult } from './types';
import { supabase } from '@/integrations/supabase/client';

/**
 * Initialize PhonePe payment
 * PhonePe uses server-to-server API, so we redirect to PhonePe payment page
 */
export const initiatePhonePePayment = async (
  orderDetails: OrderDetails,
  storeId: string
): Promise<PaymentResult> => {
  try {
    // Call backend to create PhonePe payment request
    const { data, error } = await supabase.functions.invoke('create-phonepe-payment', {
      body: {
        amount: Math.round(orderDetails.amount * 100), // Convert to paise
        orderId: orderDetails.orderNumber,
        customerName: orderDetails.customerName,
        customerPhone: orderDetails.customerPhone,
        customerEmail: orderDetails.customerEmail,
        storeId,
      },
    });

    if (error) throw error;

    // Redirect to PhonePe payment page
    if (data.paymentUrl) {
      window.location.href = data.paymentUrl;
      return { success: true, gatewayOrderId: data.merchantTransactionId };
    }

    return { success: false, error: 'No payment URL received' };
  } catch (error: any) {
    console.error('PhonePe payment error:', error);
    return {
      success: false,
      error: error.message || 'Failed to initiate PhonePe payment',
    };
  }
};

/**
 * Verify PhonePe payment status
 */
export const verifyPhonePePayment = async (
  merchantTransactionId: string,
  storeId: string
): Promise<{ verified: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('verify-phonepe-payment', {
      body: {
        merchantTransactionId,
        storeId,
      },
    });

    if (error) throw error;

    return { verified: data.verified };
  } catch (error: any) {
    console.error('Error verifying PhonePe payment:', error);
    return { verified: false, error: error.message };
  }
};
