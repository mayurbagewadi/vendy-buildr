import { useEffect, useLayoutEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const CSS_CACHE_PREFIX = "ai-design-css-";

function getCacheKey(storeSlug?: string | null): string | null {
  return storeSlug ? CSS_CACHE_PREFIX + storeSlug : null;
}

/**
 * Hook that loads and injects AI-generated CSS (Layer 2) from store_design_state.
 * Called from Header component so every customer-facing page gets the CSS.
 *
 * Two-phase injection:
 * 1. useLayoutEffect (SYNC, before paint): checks localStorage cache, injects instantly
 * 2. useEffect (ASYNC, after paint): fetches from DB, updates cache + style tag
 *
 * This eliminates the flash of default design on page refresh.
 */
export function useAIDesignCSS(storeId?: string | null, storeSlug?: string | null) {
  // PHASE 1: Synchronous injection from localStorage cache (before browser paints)
  useLayoutEffect(() => {
    if (document.getElementById("ai-layer2-styles")) return;
    const key = getCacheKey(storeSlug);
    if (!key) return;
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const el = document.createElement("style");
        el.id = "ai-layer2-styles";
        el.textContent = cached;
        document.head.appendChild(el);
      }
    } catch {
      // localStorage not available — fall through to async fetch
    }
  }, [storeSlug]);

  // PHASE 2: Async fetch from DB — verifies/updates cache
  useEffect(() => {
    if (!storeId && !storeSlug) return;

    let cancelled = false;

    const loadCSS = async () => {
      try {
        let resolvedStoreId = storeId;

        // If we only have slug, resolve to store ID first
        // Query by BOTH subdomain and slug (storeSlug may be a subdomain identifier)
        if (!resolvedStoreId && storeSlug) {
          let query = supabase
            .from("stores")
            .select("id")
            .eq("is_active", true);

          if (storeSlug.includes('.')) {
            query = query.or("custom_domain.eq." + storeSlug + ",subdomain.eq." + storeSlug);
          } else {
            query = query.or("subdomain.eq." + storeSlug + ",slug.eq." + storeSlug);
          }

          const { data: store } = await query.maybeSingle();
          if (!store?.id || cancelled) return;
          resolvedStoreId = store.id;
        }

        if (!resolvedStoreId || cancelled) return;

        const { data } = await supabase
          .from("store_design_state")
          .select("ai_full_css, mode")
          .eq("store_id", resolvedStoreId)
          .maybeSingle();

        if (cancelled) return;

        const key = getCacheKey(storeSlug);

        if (data?.mode === "advanced" && data?.ai_full_css) {
          // Save to localStorage for instant injection on next page load
          if (key) {
            try { localStorage.setItem(key, data.ai_full_css); } catch {}
          }

          // Update or create style tag
          let el = document.getElementById("ai-layer2-styles");
          if (!el) {
            el = document.createElement("style");
            el.id = "ai-layer2-styles";
            document.head.appendChild(el);
          }
          el.textContent = data.ai_full_css;
        } else {
          // No design — clear cache and remove style tag
          if (key) {
            try { localStorage.removeItem(key); } catch {}
          }
          const el = document.getElementById("ai-layer2-styles");
          if (el) el.remove();
        }
      } catch (err) {
        console.error("[useAIDesignCSS] Failed to load AI design:", err);
      }
    };

    loadCSS();

    return () => {
      cancelled = true;
    };
  }, [storeId, storeSlug]);
}
