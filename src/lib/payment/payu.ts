// PayU payment gateway integration

import { OrderDetails, PaymentResult } from './types';
import { supabase } from '@/integrations/supabase/client';

/**
 * Initiate PayU payment
 * PayU uses form-based redirect
 */
export const initiatePayUPayment = async (
  orderDetails: OrderDetails,
  storeId: string
): Promise<PaymentResult> => {
  try {
    // Get payment parameters from backend
    const { data, error } = await supabase.functions.invoke('create-payu-payment', {
      body: {
        amount: orderDetails.amount,
        orderId: orderDetails.orderNumber,
        customerName: orderDetails.customerName,
        customerEmail: orderDetails.customerEmail || 'customer@example.com',
        customerPhone: orderDetails.customerPhone,
        storeId,
      },
    });

    if (error) throw error;

    // Create form and submit to PayU
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = data.paymentUrl;

    // Add all payment parameters as hidden fields
    Object.keys(data.params).forEach((key) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = data.params[key];
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();

    return { success: true, gatewayOrderId: data.params.txnid };
  } catch (error: any) {
    console.error('PayU payment error:', error);
    return {
      success: false,
      error: error.message || 'Failed to initiate PayU payment',
    };
  }
};

/**
 * Verify PayU payment
 */
export const verifyPayUPayment = async (
  txnid: string,
  status: string,
  hash: string,
  storeId: string
): Promise<{ verified: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('verify-payu-payment', {
      body: {
        txnid,
        status,
        hash,
        storeId,
      },
    });

    if (error) throw error;

    return { verified: data.verified };
  } catch (error: any) {
    console.error('Error verifying PayU payment:', error);
    return { verified: false, error: error.message };
  }
};
