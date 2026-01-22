/**
 * Enterprise-level Marketplace Payment Service
 * Handles all marketplace feature purchase logic with reusable patterns
 */

import { supabase } from '@/integrations/supabase/client';
import { loadRazorpayScript } from '@/lib/payment/razorpay';

export type PricingType = 'onetime' | 'monthly' | 'yearly';

export interface MarketplaceFeature {
  id: string;
  name: string;
  slug: string;
  description: string;
  is_free: boolean;
  price: number;
  pricing_model?: string;
  price_onetime?: number;
  price_monthly?: number;
  price_yearly?: number;
  quota_onetime?: number;
  quota_monthly?: number;
  quota_yearly?: number;
}

export interface PricingOption {
  type: PricingType;
  price: number;
  quota: number;
  label: string;
  description: string;
}

export interface PurchaseResult {
  success: boolean;
  error?: string;
  purchase?: any;
}

export interface PaymentCredentials {
  key_id: string;
}

/**
 * Get available pricing options for a feature
 */
export const getFeaturePricingOptions = (feature: MarketplaceFeature): PricingOption[] => {
  if (feature.is_free) {
    return [];
  }

  const options: PricingOption[] = [];
  const model = feature.pricing_model || 'onetime';

  if (model === 'onetime' || model === 'mixed') {
    options.push({
      type: 'onetime',
      price: feature.price_onetime || feature.price,
      quota: feature.quota_onetime || 15,
      label: 'One-time Purchase',
      description: `${feature.quota_onetime || 15} API calls per month, lifetime access`,
    });
  }

  if (model === 'monthly' || model === 'mixed') {
    options.push({
      type: 'monthly',
      price: feature.price_monthly || 0,
      quota: feature.quota_monthly || 30,
      label: 'Monthly Subscription',
      description: `${feature.quota_monthly || 30} API calls per month, auto-renew`,
    });
  }

  if (model === 'yearly' || model === 'mixed') {
    options.push({
      type: 'yearly',
      price: feature.price_yearly || 0,
      quota: feature.quota_yearly || 50,
      label: 'Yearly Subscription',
      description: `${feature.quota_yearly || 50} API calls per month, billed annually`,
    });
  }

  return options;
};

/**
 * Check if user has already purchased a feature
 */
export const checkExistingPurchase = async (
  storeId: string,
  featureSlug: string
): Promise<{ purchased: boolean; purchase?: any }> => {
  try {
    const { data, error } = await supabase
      .from('marketplace_purchases')
      .select('*')
      .eq('store_id', storeId)
      .eq('feature_slug', featureSlug)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;

    return {
      purchased: !!data,
      purchase: data,
    };
  } catch (error) {
    console.error('Error checking existing purchase:', error);
    return { purchased: false };
  }
};

/**
 * Get Razorpay credentials from platform settings via edge function
 * This is more secure as credentials are never exposed to the client
 * @deprecated - Credentials are now handled entirely server-side in edge functions
 */
export const getRazorpayCredentials = async (storeId: string): Promise<PaymentCredentials | null> => {
  // This function is kept for backward compatibility but is no longer used
  // All payment operations now go through the marketplace-payment edge function
  // which handles credentials server-side
  console.warn('getRazorpayCredentials is deprecated. Use marketplace-payment edge function instead.');
  return null;
};

/**
 * Process marketplace feature purchase using edge function (Enterprise pattern)
 * All payment credentials and verification logic handled server-side
 */
export const purchaseMarketplaceFeature = async (
  feature: MarketplaceFeature,
  pricingType: PricingType,
  storeId: string,
  userId: string,
  customerDetails: {
    name: string;
    email: string;
    phone: string;
  }
): Promise<PurchaseResult> => {
  try {
    // Get pricing option
    const pricingOptions = getFeaturePricingOptions(feature);
    const selectedOption = pricingOptions.find((opt) => opt.type === pricingType);

    if (!selectedOption) {
      return { success: false, error: 'Invalid pricing option' };
    }

    // Check if already purchased
    const { purchased } = await checkExistingPurchase(storeId, feature.slug);
    if (purchased) {
      return { success: false, error: 'Feature already purchased' };
    }

    // Load Razorpay SDK
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      return { success: false, error: 'Failed to load payment gateway' };
    }

    // Create payment order via edge function (credentials handled server-side)
    console.log('🚀 Calling marketplace-payment edge function with:', {
      action: 'create_order',
      feature_slug: feature.slug,
      pricing_type: pricingType,
      store_id: storeId,
      user_id: userId,
    });

    const { data: orderData, error: orderError } = await supabase.functions.invoke('marketplace-payment', {
      body: {
        action: 'create_order',
        feature_slug: feature.slug,
        pricing_type: pricingType,
        store_id: storeId,
        user_id: userId,
      },
    });

    console.log('📥 Edge function response:', { orderData, orderError });

    if (orderError || !orderData?.success) {
      console.error('❌ Edge function error:', orderError);
      console.error('❌ Order data:', orderData);
      return {
        success: false,
        error: orderData?.error || orderError?.message || 'Failed to create payment order'
      };
    }

    // Open Razorpay checkout with server-provided credentials
    return new Promise((resolve) => {
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Marketplace',
        description: `${feature.name} - ${selectedOption.label}`,
        order_id: orderData.order_id,
        prefill: {
          name: customerDetails.name,
          email: customerDetails.email,
          contact: customerDetails.phone,
        },
        theme: {
          color: '#3B82F6',
        },
        handler: async function (response: any) {
          try {
            // Verify payment via edge function
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('marketplace-payment', {
              body: {
                action: 'verify_payment',
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                feature_slug: feature.slug,
                pricing_type: pricingType,
                store_id: storeId,
                user_id: userId,
              },
            });

            if (verifyError || !verifyData?.success) {
              resolve({
                success: false,
                error: verifyData?.error || verifyError?.message || 'Payment verification failed'
              });
              return;
            }

            resolve({ success: true, purchase: verifyData.purchase });
          } catch (error: any) {
            resolve({ success: false, error: error.message || 'Payment processing failed' });
          }
        },
        modal: {
          ondismiss: function () {
            resolve({ success: false, error: 'Payment cancelled by user' });
          },
        },
      };

      // @ts-ignore - Razorpay is loaded dynamically
      const razorpay = new window.Razorpay(options);

      razorpay.on('payment.failed', function (response: any) {
        resolve({
          success: false,
          error: response.error.description || 'Payment failed',
        });
      });

      razorpay.open();
    });
  } catch (error: any) {
    console.error('Purchase error:', error);
    return { success: false, error: error.message || 'Failed to process purchase' };
  }
};

/**
 * Enable feature for free features
 */
export const enableFreeFeature = async (
  storeId: string,
  featureSlug: string,
  currentEnabledFeatures: string[]
): Promise<{ success: boolean; error?: string }> => {
  try {
    const newEnabledFeatures = [...currentEnabledFeatures, featureSlug];

    const { error } = await supabase
      .from('stores')
      .update({ enabled_features: newEnabledFeatures })
      .eq('id', storeId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error enabling free feature:', error);
    return { success: false, error: error.message || 'Failed to enable feature' };
  }
};
