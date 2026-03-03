import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook that loads and injects AI-generated CSS (Layer 2) from store_design_state.
 * Called from Header component so every customer-facing page gets the CSS.
 *
 * Skips the DB fetch if the <style id="ai-layer2-styles"> tag already exists
 * (e.g., if customer navigated from the home page where Store.tsx already injected it).
 */
export function useAIDesignCSS(storeId?: string | null, storeSlug?: string | null) {
  useEffect(() => {
    // Already injected by Store.tsx or a previous page — nothing to do
    if (document.getElementById("ai-layer2-styles")) return;

    // Need at least one identifier to look up the store
    if (!storeId && !storeSlug) return;

    let cancelled = false;

    const loadCSS = async () => {
      try {
        let resolvedStoreId = storeId;

        // If we only have slug, resolve to store ID first
        if (!resolvedStoreId && storeSlug) {
          const { data: store } = await supabase
            .from("stores")
            .select("id")
            .eq("slug", storeSlug)
            .eq("is_active", true)
            .maybeSingle();
          if (!store?.id || cancelled) return;
          resolvedStoreId = store.id;
        }

        if (!resolvedStoreId || cancelled) return;

        // Double-check — another component may have injected while we were fetching
        if (document.getElementById("ai-layer2-styles")) return;

        const { data } = await supabase
          .from("store_design_state")
          .select("ai_full_css, mode")
          .eq("store_id", resolvedStoreId)
          .maybeSingle();

        if (cancelled) return;

        if (data?.mode === "advanced" && data?.ai_full_css) {
          // Final check before injecting
          if (document.getElementById("ai-layer2-styles")) return;

          const styleEl = document.createElement("style");
          styleEl.id = "ai-layer2-styles";
          styleEl.textContent = data.ai_full_css;
          document.head.appendChild(styleEl);
        }
      } catch (err) {
        // Silently fail — design CSS is non-critical
        console.error("[useAIDesignCSS] Failed to load AI design:", err);
      }
    };

    loadCSS();

    return () => {
      cancelled = true;
    };
  }, [storeId, storeSlug]);
}
