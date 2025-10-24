import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionLimits {
  maxProducts: number | null;
  currentProducts: number;
  whatsappOrdersLimit: number | null;
  whatsappOrdersUsed: number;
  websiteOrdersLimit: number | null;
  websiteOrdersUsed: number;
  enableAnalytics: boolean;
  enableLocationSharing: boolean;
  isLoading: boolean;
  hasActiveSubscription: boolean;
}

export function useSubscriptionLimits() {
  const [limits, setLimits] = useState<SubscriptionLimits>({
    maxProducts: null,
    currentProducts: 0,
    whatsappOrdersLimit: null,
    whatsappOrdersUsed: 0,
    websiteOrdersLimit: null,
    websiteOrdersUsed: 0,
    enableAnalytics: false,
    enableLocationSharing: false,
    isLoading: true,
    hasActiveSubscription: false,
  });

  useEffect(() => {
    loadLimits();

    // Set up realtime listeners for subscription changes
    const subscriptionsChannel = supabase
      .channel('subscriptions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions'
        },
        () => {
          console.log('Subscription changed, reloading limits...');
          loadLimits();
        }
      )
      .subscribe();

    // Listen for subscription plan changes
    const plansChannel = supabase
      .channel('plans-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscription_plans'
        },
        () => {
          console.log('Subscription plan changed, reloading limits...');
          loadLimits();
        }
      )
      .subscribe();

    return () => {
      subscriptionsChannel.unsubscribe();
      plansChannel.unsubscribe();
    };
  }, []);

  const loadLimits = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLimits(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Get subscription with plan details
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select(`
          *,
          subscription_plans(
            max_products,
            whatsapp_orders_limit,
            website_orders_limit,
            enable_analytics,
            enable_location_sharing
          )
        `)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!subscription || !subscription.subscription_plans) {
        setLimits(prev => ({ ...prev, isLoading: false, hasActiveSubscription: false }));
        return;
      }

      // Get store and count published products
      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("user_id", user.id)
        .single();

      let publishedCount = 0;
      if (store) {
        const { count } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("store_id", store.id)
          .eq("status", "published");
        
        publishedCount = count || 0;
      }

      const plan = subscription.subscription_plans;
      setLimits({
        maxProducts: plan.max_products,
        currentProducts: publishedCount,
        whatsappOrdersLimit: plan.whatsapp_orders_limit,
        whatsappOrdersUsed: subscription.whatsapp_orders_used || 0,
        websiteOrdersLimit: plan.website_orders_limit,
        websiteOrdersUsed: subscription.website_orders_used || 0,
        enableAnalytics: plan.enable_analytics || false,
        enableLocationSharing: plan.enable_location_sharing || false,
        isLoading: false,
        hasActiveSubscription: ['active', 'trial'].includes(subscription.status),
      });
    } catch (error) {
      console.error("Error loading subscription limits:", error);
      setLimits(prev => ({ ...prev, isLoading: false }));
    }
  };

  const canPublishProduct = () => {
    if (!limits.hasActiveSubscription) return false;
    if (limits.maxProducts === null) return true; // Unlimited
    return limits.currentProducts < limits.maxProducts;
  };

  const canPlaceWhatsAppOrder = () => {
    if (!limits.hasActiveSubscription) return false;
    if (limits.whatsappOrdersLimit === null) return false; // Feature disabled
    if (limits.whatsappOrdersLimit === 0) return true; // Unlimited
    return limits.whatsappOrdersUsed < limits.whatsappOrdersLimit;
  };

  const canPlaceWebsiteOrder = () => {
    if (!limits.hasActiveSubscription) return false;
    if (limits.websiteOrdersLimit === null) return false; // Feature disabled
    if (limits.websiteOrdersLimit === 0) return true; // Unlimited
    return limits.websiteOrdersUsed < limits.websiteOrdersLimit;
  };

  const getOrderLimitWarning = () => {
    if (!limits.hasActiveSubscription) {
      return "No active subscription. Please upgrade to place orders.";
    }
    
    const whatsappLimit = limits.whatsappOrdersLimit;
    const whatsappUsed = limits.whatsappOrdersUsed;
    const websiteLimit = limits.websiteOrdersLimit;
    const websiteUsed = limits.websiteOrdersUsed;
    
    // Check if features are disabled
    if (whatsappLimit === null && websiteLimit === null) {
      return "Ordering features are not available in your current plan.";
    }
    
    // Check WhatsApp limits
    if (whatsappLimit !== null && whatsappLimit > 0) {
      const whatsappRemaining = whatsappLimit - whatsappUsed;
      if (whatsappRemaining <= 0) {
        return `WhatsApp order limit reached (${whatsappUsed}/${whatsappLimit}). Upgrade your plan to accept more orders.`;
      }
      if (whatsappRemaining <= 3) {
        return `Warning: Only ${whatsappRemaining} WhatsApp order slots remaining (${whatsappUsed}/${whatsappLimit}).`;
      }
    }
    
    // Check Website limits
    if (websiteLimit !== null && websiteLimit > 0) {
      const websiteRemaining = websiteLimit - websiteUsed;
      if (websiteRemaining <= 0) {
        return `Website order limit reached (${websiteUsed}/${websiteLimit}). Upgrade your plan to accept more orders.`;
      }
      if (websiteRemaining <= 3) {
        return `Warning: Only ${websiteRemaining} website order slots remaining (${websiteUsed}/${websiteLimit}).`;
      }
    }
    
    return null;
  };

  const getProductLimitMessage = () => {
    if (!limits.hasActiveSubscription) {
      return "No active subscription. Please upgrade to publish products.";
    }
    if (limits.maxProducts === null) return null;
    const remaining = limits.maxProducts - limits.currentProducts;
    if (remaining <= 0) {
      return `Product limit reached (${limits.currentProducts}/${limits.maxProducts}). Upgrade your plan to publish more products.`;
    }
    if (remaining <= 3) {
      return `Warning: Only ${remaining} product slots remaining (${limits.currentProducts}/${limits.maxProducts}).`;
    }
    return null;
  };

  return {
    ...limits,
    canPublishProduct,
    canPlaceWhatsAppOrder,
    canPlaceWebsiteOrder,
    getProductLimitMessage,
    getOrderLimitWarning,
    refresh: loadLimits,
  };
}
