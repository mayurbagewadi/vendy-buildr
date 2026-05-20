import { useEffect, useLayoutEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const CSS_CACHE_PREFIX = "ai-design-css-";

function getCacheKey(storeSlug?: string | null): string | null {
  return storeSlug ? CSS_CACHE_PREFIX + storeSlug : null;
}

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
    } catch {}
  }, [storeSlug]);

  // PHASE 2: Async fetch from DB — verifies/updates cache
  useEffect(() => {
    if (!storeId && !storeSlug) return;

    let cancelled = false;

    const loadCSS = async () => {
      try {
        let resolvedStoreId = storeId;

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
          if (!store?.id) return;
          if (cancelled) return;
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
          if (key) {
            try { localStorage.setItem(key, data.ai_full_css); } catch {}
          }

          let el = document.getElementById("ai-layer2-styles");
          if (!el) {
            el = document.createElement("style");
            el.id = "ai-layer2-styles";
            document.head.appendChild(el);
          }
          el.textContent = data.ai_full_css;
        } else {
          if (key) {
            try { localStorage.removeItem(key); } catch {}
          }
          document.getElementById("ai-layer2-styles")?.remove();
        }
      } catch {}
    };

    loadCSS();

    return () => { cancelled = true; };
  }, [storeId, storeSlug]);
}
