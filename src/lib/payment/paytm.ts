// Paytm payment gateway integration

import { OrderDetails, PaymentResult } from './types';
import { supabase } from '@/integrations/supabase/client';

/**
 * Initiate Paytm payment
 */
export const initiatePaytmPayment = async (
  orderDetails: OrderDetails,
  storeId: string
): Promise<PaymentResult> => {
  try {
    // Generate payment token from backend
    const { data, error } = await supabase.functions.invoke('create-paytm-payment', {
      body: {
        amount: orderDetails.amount,
        orderId: orderDetails.orderNumber,
        customerName: orderDetails.customerName,
        customerPhone: orderDetails.customerPhone,
        customerEmail: orderDetails.customerEmail || 'customer@example.com',
        storeId,
      },
    });

    if (error) throw error;

    // Redirect to Paytm payment page
    if (data.paymentUrl) {
      window.location.href = data.paymentUrl;
      return { success: true, gatewayOrderId: data.orderId };
    }

    return { success: false, error: 'No payment URL received' };
  } catch (error: any) {
    console.error('Paytm payment error:', error);
    return {
      success: false,
      error: error.message || 'Failed to initiate Paytm payment',
    };
  }
};

/**
 * Verify Paytm payment
 */
export const verifyPaytmPayment = async (
  orderId: string,
  storeId: string
): Promise<{ verified: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('verify-paytm-payment', {
      body: {
        orderId,
        storeId,
      },
    });

    if (error) throw error;

    return { verified: data.verified };
  } catch (error: any) {
    console.error('Error verifying Paytm payment:', error);
    return { verified: false, error: error.message };
  }
};
