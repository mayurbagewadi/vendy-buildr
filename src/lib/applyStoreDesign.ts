/**
 * applyStoreDesign.ts
 *
 * Single source of truth for injecting AI-generated CSS (Layer 1 + Layer 2)
 * into the live document. Previously duplicated across Store.tsx and
 * ProductDetail.tsx — centralised here for consistency and maintainability.
 *
 * Layer 1 — CSS variables (--primary, --radius, etc.)
 * Layer 2 — Full CSS override (advanced mode, arbitrary selectors)
 */

import { buildDesignCSS, AIDesignResult } from './aiDesigner';

export interface StoreDesignData {
  current_design: unknown;
  ai_full_css: string | null;
  mode: string | null;
}

/**
 * Apply AI design CSS to the document.
 * Returns the parsed AIDesignResult for layout calculations, or null.
 * Safe to call multiple times — reuses existing <style> tags.
 */
export function applyStoreDesignCSS(design: StoreDesignData | null): AIDesignResult | null {
  // ── Layer 2: full CSS override ────────────────────────────────────────────
  const l2Id = 'ai-layer2-styles';
  if (design?.mode === 'advanced' && design?.ai_full_css) {
    let el = document.getElementById(l2Id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = l2Id;
      document.head.appendChild(el);
    }
    el.textContent = design.ai_full_css;
  } else {
    document.getElementById(l2Id)?.remove();
  }

  // ── Layer 1: CSS variables ────────────────────────────────────────────────
  const l1Id = 'ai-designer-styles';
  if (design?.current_design) {
    const designResult = design.current_design as unknown as AIDesignResult;
    const css = buildDesignCSS(designResult);
    let el = document.getElementById(l1Id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = l1Id;
      document.head.appendChild(el);
    }
    el.textContent = css;
    return designResult;
  }

  document.getElementById(l1Id)?.remove();
  return null;
}

/**
 * Remove all AI design CSS from the document.
 * Called on reset or when navigating away from a styled store.
 */
export function removeStoreDesignCSS(): void {
  document.getElementById('ai-layer2-styles')?.remove();
  document.getElementById('ai-designer-styles')?.remove();
}
