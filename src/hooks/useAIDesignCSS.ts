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
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎨 [AI-CSS] PHASE 1: useLayoutEffect (before paint)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  storeId:", storeId);
    console.log("  storeSlug:", storeSlug);
    console.log("  ai-layer2-styles exists:", !!document.getElementById("ai-layer2-styles"));

    if (document.getElementById("ai-layer2-styles")) {
      console.log("  ⏭️ SKIP: ai-layer2-styles already in DOM");
      return;
    }
    const key = getCacheKey(storeSlug);
    console.log("  localStorage key:", key);
    if (!key) {
      console.log("  ⏭️ SKIP: no cache key (storeSlug is empty)");
      return;
    }
    try {
      const cached = localStorage.getItem(key);
      console.log("  localStorage cached CSS:", cached ? "YES (" + cached.length + " chars)" : "NO (null)");
      if (cached) {
        const el = document.createElement("style");
        el.id = "ai-layer2-styles";
        el.textContent = cached;
        document.head.appendChild(el);
        console.log("  ✅ INJECTED from localStorage cache (before paint)");
      } else {
        console.log("  ⚠️ No cached CSS — will wait for async DB fetch");
      }
    } catch (e) {
      console.log("  ❌ localStorage error:", e);
    }
  }, [storeSlug]);

  // PHASE 2: Async fetch from DB — verifies/updates cache
  useEffect(() => {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔄 [AI-CSS] PHASE 2: useEffect (async DB fetch)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  storeId:", storeId);
    console.log("  storeSlug:", storeSlug);

    if (!storeId && !storeSlug) {
      console.log("  ⏭️ SKIP: no storeId and no storeSlug");
      return;
    }

    let cancelled = false;

    const loadCSS = async () => {
      try {
        let resolvedStoreId = storeId;
        console.log("  resolvedStoreId (initial):", resolvedStoreId);

        // If we only have slug, resolve to store ID first
        // Query by BOTH subdomain and slug (storeSlug may be a subdomain identifier)
        if (!resolvedStoreId && storeSlug) {
          console.log("  🔍 Looking up store by slug/subdomain:", storeSlug);
          let query = supabase
            .from("stores")
            .select("id")
            .eq("is_active", true);

          if (storeSlug.includes('.')) {
            query = query.or("custom_domain.eq." + storeSlug + ",subdomain.eq." + storeSlug);
            console.log("  Query: custom_domain OR subdomain = " + storeSlug);
          } else {
            query = query.or("subdomain.eq." + storeSlug + ",slug.eq." + storeSlug);
            console.log("  Query: subdomain OR slug = " + storeSlug);
          }

          const { data: store, error: storeError } = await query.maybeSingle();
          console.log("  Store lookup result:", store);
          if (storeError) console.log("  Store lookup error:", storeError);
          if (!store?.id) {
            console.log("  ❌ Store NOT FOUND — CSS will NOT be loaded");
            return;
          }
          if (cancelled) {
            console.log("  ⏭️ CANCELLED after store lookup");
            return;
          }
          resolvedStoreId = store.id;
          console.log("  ✅ Store found, resolvedStoreId:", resolvedStoreId);
        }

        if (!resolvedStoreId) {
          console.log("  ❌ No resolvedStoreId — aborting");
          return;
        }
        if (cancelled) {
          console.log("  ⏭️ CANCELLED before design fetch");
          return;
        }

        console.log("  🔍 Fetching store_design_state for store:", resolvedStoreId);
        const { data, error: designError } = await supabase
          .from("store_design_state")
          .select("ai_full_css, mode")
          .eq("store_id", resolvedStoreId)
          .maybeSingle();

        console.log("  Design data:", data ? { mode: data.mode, css_length: data.ai_full_css?.length || 0 } : "null");
        if (designError) console.log("  Design fetch error:", designError);

        if (cancelled) {
          console.log("  ⏭️ CANCELLED after design fetch");
          return;
        }

        const key = getCacheKey(storeSlug);

        if (data?.mode === "advanced" && data?.ai_full_css) {
          console.log("  ✅ Design found (mode=advanced, css=" + data.ai_full_css.length + " chars)");

          // Save to localStorage for instant injection on next page load
          if (key) {
            try {
              localStorage.setItem(key, data.ai_full_css);
              console.log("  💾 Saved to localStorage key:", key);
            } catch (e) {
              console.log("  ⚠️ Failed to save to localStorage:", e);
            }
          }

          // Update or create style tag
          let el = document.getElementById("ai-layer2-styles");
          const existed = !!el;
          if (!el) {
            el = document.createElement("style");
            el.id = "ai-layer2-styles";
            document.head.appendChild(el);
          }
          el.textContent = data.ai_full_css;
          console.log("  💉 Style tag " + (existed ? "UPDATED" : "CREATED") + " with " + data.ai_full_css.length + " chars");
        } else {
          console.log("  ⚠️ No advanced design found (mode=" + data?.mode + ", has_css=" + !!data?.ai_full_css + ")");
          // No design — clear cache and remove style tag
          if (key) {
            try { localStorage.removeItem(key); } catch {}
          }
          const el = document.getElementById("ai-layer2-styles");
          if (el) {
            el.remove();
            console.log("  🗑️ Removed ai-layer2-styles tag (no design)");
          }
        }
      } catch (err) {
        console.error("[useAIDesignCSS] Failed to load AI design:", err);
      }

      console.log("  📌 Final state: ai-layer2-styles in DOM =", !!document.getElementById("ai-layer2-styles"));
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    };

    loadCSS();

    return () => {
      cancelled = true;
      console.log("  🧹 [AI-CSS] Cleanup: cancelled=true (storeId=" + storeId + ", storeSlug=" + storeSlug + ")");
    };
  }, [storeId, storeSlug]);
}
