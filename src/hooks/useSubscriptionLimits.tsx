import { useState, useEffect, useRef } from "react";
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
  enableCustomDomain: boolean;
  enableAiVoice: boolean;
  enableDiscountsCoupons: boolean;
  enableSeo: boolean;
  isLoading: boolean;
  hasActiveSubscription: boolean;
}

const DEFAULTS: SubscriptionLimits = {
  maxProducts: null,
  currentProducts: 0,
  whatsappOrdersLimit: null,
  whatsappOrdersUsed: 0,
  websiteOrdersLimit: null,
  websiteOrdersUsed: 0,
  enableAnalytics: false,
  enableLocationSharing: false,
  enableCustomDomain: false,
  enableAiVoice: false,
  enableDiscountsCoupons: false,
  enableSeo: false,
  isLoading: true,
  hasActiveSubscription: false,
};

// Cache key scoped per user — different users on same device get separate caches
const getCacheKey = (userId: string) => `sub_limits_${userId}`;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const readCache = (userId: string): SubscriptionLimits | null => {
  try {
    const raw = sessionStorage.getItem(getCacheKey(userId));
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
};

const writeCache = (userId: string, data: SubscriptionLimits) => {
  try {
    sessionStorage.setItem(getCacheKey(userId), JSON.stringify({ data, ts: Date.now() }));
  } catch {}
};

const clearCache = (userId: string) => {
  try {
    sessionStorage.removeItem(getCacheKey(userId));
  } catch {}
};

export function useSubscriptionLimits() {
  const [limits, setLimits] = useState<SubscriptionLimits>(DEFAULTS);
  const userIdRef = useRef<string | null>(null);

  const loadLimits = async (bustCache = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLimits(prev => ({ ...prev, isLoading: false }));
        return;
      }

      userIdRef.current = user.id;

      // Serve from cache unless caller explicitly busts it (Realtime events do)
      if (!bustCache) {
        const cached = readCache(user.id);
        if (cached) {
          setLimits({ ...cached, isLoading: false });
          return;
        }
      }

      // Round trip 1: subscription + store queries run in parallel (independent)
      const [subscriptionsResult, storeResult] = await Promise.all([
        supabase
          .from("subscriptions")
          .select(`
            *,
            subscription_plans(
              max_products,
              whatsapp_orders_limit,
              website_orders_limit,
              enable_analytics,
              enable_location_sharing,
              enable_custom_domain,
              enable_ai_voice,
              enable_discounts_coupons,
              enable_seo
            )
          `)
          .eq("user_id", user.id)
          .in("status", ["active", "trial"])
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("stores")
          .select("id")
          .eq("user_id", user.id)
          .single(),
      ]);

      const subscription =
        subscriptionsResult.data && subscriptionsResult.data.length > 0
          ? subscriptionsResult.data[0]
          : null;

      if (!subscription || !subscription.subscription_plans) {
        const next = { ...DEFAULTS, isLoading: false, hasActiveSubscription: false };
        setLimits(next);
        writeCache(user.id, next);
        return;
      }

      // Round trip 2: product count — depends on storeResult from round trip 1
      let publishedCount = 0;
      const store = storeResult.data;
      if (store) {
        const { count } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("store_id", store.id)
          .eq("status", "published");
        publishedCount = count || 0;
      }

      const plan = subscription.subscription_plans as any;
      const next: SubscriptionLimits = {
        maxProducts: plan.max_products,
        currentProducts: publishedCount,
        whatsappOrdersLimit: plan.whatsapp_orders_limit,
        whatsappOrdersUsed: subscription.whatsapp_orders_used || 0,
        websiteOrdersLimit: plan.website_orders_limit,
        websiteOrdersUsed: subscription.website_orders_used || 0,
        enableAnalytics: plan.enable_analytics || false,
        enableLocationSharing: plan.enable_location_sharing || false,
        enableCustomDomain: plan.enable_custom_domain || false,
        enableAiVoice: plan.enable_ai_voice || false,
        enableDiscountsCoupons: plan.enable_discounts_coupons || false,
        enableSeo: plan.enable_seo || false,
        isLoading: false,
        hasActiveSubscription: ['active', 'trial'].includes(subscription.status),
      };

      setLimits(next);
      writeCache(user.id, next);
    } catch (error) {
      console.error("Error loading subscription limits:", error);
      setLimits(prev => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    loadLimits();

    const subscriptionsChannel = supabase
      .channel('subscriptions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => {
        // Bust cache when subscription row changes (plan upgrade/downgrade)
        if (userIdRef.current) clearCache(userIdRef.current);
        loadLimits(true);
      })
      .subscribe();

    const plansChannel = supabase
      .channel('plans-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_plans' }, () => {
        if (userIdRef.current) clearCache(userIdRef.current);
        loadLimits(true);
      })
      .subscribe();

    return () => {
      // Fix: was using .unsubscribe() which left WebSocket connections open
      supabase.removeChannel(subscriptionsChannel);
      supabase.removeChannel(plansChannel);
    };
  }, []);

  const canPublishProduct = () => {
    if (!limits.hasActiveSubscription) return false;
    if (limits.maxProducts === null) return true;
    return limits.currentProducts < limits.maxProducts;
  };

  const canPlaceWhatsAppOrder = () => {
    if (!limits.hasActiveSubscription) return false;
    if (limits.whatsappOrdersLimit === null) return false;
    if (limits.whatsappOrdersLimit === 0) return true;
    return limits.whatsappOrdersUsed < limits.whatsappOrdersLimit;
  };

  const canPlaceWebsiteOrder = () => {
    if (!limits.hasActiveSubscription) return false;
    if (limits.websiteOrdersLimit === null) return false;
    if (limits.websiteOrdersLimit === 0) return true;
    return limits.websiteOrdersUsed < limits.websiteOrdersLimit;
  };

  const getOrderLimitWarning = () => {
    if (!limits.hasActiveSubscription) return "No active subscription. Please upgrade to place orders.";

    const { whatsappOrdersLimit: wl, whatsappOrdersUsed: wu, websiteOrdersLimit: bl, websiteOrdersUsed: bu } = limits;

    if (wl === null && bl === null) return "Ordering features are not available in your current plan.";

    if (wl !== null && wl > 0) {
      const rem = wl - wu;
      if (rem <= 0) return `WhatsApp order limit reached (${wu}/${wl}). Upgrade your plan to accept more orders.`;
      if (rem <= 3) return `Warning: Only ${rem} WhatsApp order slots remaining (${wu}/${wl}).`;
    }

    if (bl !== null && bl > 0) {
      const rem = bl - bu;
      if (rem <= 0) return `Website order limit reached (${bu}/${bl}). Upgrade your plan to accept more orders.`;
      if (rem <= 3) return `Warning: Only ${rem} website order slots remaining (${bu}/${bl}).`;
    }

    return null;
  };

  const getProductLimitMessage = () => {
    if (!limits.hasActiveSubscription) return "No active subscription. Please upgrade to publish products.";
    if (limits.maxProducts === null) return null;
    const remaining = limits.maxProducts - limits.currentProducts;
    if (remaining <= 0) return `Product limit reached (${limits.currentProducts}/${limits.maxProducts}). Upgrade your plan to publish more products.`;
    if (remaining <= 3) return `Warning: Only ${remaining} product slots remaining (${limits.currentProducts}/${limits.maxProducts}).`;
    return null;
  };

  return {
    ...limits,
    canPublishProduct,
    canPlaceWhatsAppOrder,
    canPlaceWebsiteOrder,
    getProductLimitMessage,
    getOrderLimitWarning,
    refresh: () => loadLimits(true),
  };
}
