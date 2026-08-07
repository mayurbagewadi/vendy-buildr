import { useEffect, useLayoutEffect } from "react";

// Phase 0: custom CSS now travels inside the public_storefront_bootstrap payload.
// No second DB query. The CSS is already in StoreContext when this hook runs.

const CSS_CACHE_PREFIX = "ai-design-css-";
const STYLE_ID = "ai-layer2-styles";

function getCacheKey(storeSlug?: string | null): string | null {
  return storeSlug ? CSS_CACHE_PREFIX + storeSlug : null;
}

function injectCSS(css: string): void {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

function removeCSS(): void {
  document.getElementById(STYLE_ID)?.remove();
}

/**
 * Injects published custom CSS into the page.
 * customCss comes from store.theme_state.custom_css (already in StoreContext — zero extra queries).
 * storeSlug is used only for the localStorage cache (flash-of-unstyled-content prevention).
 */
export function useAIDesignCSS(customCss?: string | null, storeSlug?: string | null) {
  // PHASE 1 — synchronous: inject from localStorage cache before the browser paints.
  // This prevents a flash of unstyled content on repeat visits while context is loading.
  useLayoutEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const key = getCacheKey(storeSlug);
    if (!key) return;
    try {
      const cached = localStorage.getItem(key);
      if (cached) injectCSS(cached);
    } catch {}
  }, [storeSlug]);

  // PHASE 2 — after context loads: sync the live value from the bootstrap payload.
  // No DB query. customCss arrives via props from StoreContext.
  useEffect(() => {
    const key = getCacheKey(storeSlug);

    if (customCss) {
      injectCSS(customCss);
      try { if (key) localStorage.setItem(key, customCss); } catch {}
    } else {
      removeCSS();
      try { if (key) localStorage.removeItem(key); } catch {}
    }
  }, [customCss, storeSlug]);
}
