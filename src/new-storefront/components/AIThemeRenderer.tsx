import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { CartItem } from "@/lib/cartUtils";
import type { StoreContextData } from "@/contexts/StoreContext";
import { getImageUrl } from "@/lib/responsiveImages";

interface AIThemeRendererProps {
  html: string;
  store: StoreContextData;
  products: any[];
  categories: any[];
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  isSubdomain: boolean;
  onNavigate?: (path: string) => void; // optional override — used by admin preview to block real navigation
  currentProduct?: any; // product_detail page only — the one product this template resolves to
  updateQuantity?: (productId: string, variant: string | undefined, quantity: number) => void; // cart page only
  removeItem?: (productId: string, variant?: string) => void; // cart page only
}

// Keeps bridge data current across renders without re-parsing HTML.
// Bridge methods close over this ref so they always read fresh cart/products.
type BridgeData = Pick<
  AIThemeRendererProps,
  "store" | "products" | "categories" | "cart" | "addToCart" | "isSubdomain" | "currentProduct" | "updateQuantity" | "removeItem"
> & {
  navigate: ReturnType<typeof useNavigate>;
};

export function AIThemeRenderer({
  html,
  store,
  products,
  categories,
  cart,
  addToCart,
  isSubdomain,
  onNavigate,
  currentProduct,
  updateQuantity,
  removeItem,
}: AIThemeRendererProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const injectedNodesRef = useRef<HTMLElement[]>([]);

  // Always-current data for the bridge — updated every render, no re-parse needed
  const bridgeRef = useRef<BridgeData>({
    store, products, categories, cart, addToCart, isSubdomain, currentProduct, updateQuantity, removeItem, navigate,
  });
  const onNavigateRef = useRef(onNavigate);
  useEffect(() => {
    bridgeRef.current = {
      store, products, categories, cart, addToCart, isSubdomain, currentProduct, updateQuantity, removeItem, navigate,
    };
    onNavigateRef.current = onNavigate;
  });

  // Main effect: parse HTML, inject styles, mount content, execute scripts.
  // Runs only when the published HTML blob changes (publish → re-mount).
  useEffect(() => {
    if (!html || !containerRef.current) return;

    const container = containerRef.current;

    // ── 1. Parse AI-generated HTML ─────────────────────────────────────────
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // ── 2. Inject <style> + Google Fonts <link> into document.head ─────────
    const injected: HTMLElement[] = [];

    doc.head.querySelectorAll("style").forEach((el) => {
      const node = document.createElement("style");
      node.setAttribute("data-ai-theme", "true");
      node.textContent = el.textContent;
      document.head.appendChild(node);
      injected.push(node);
    });

    doc.head.querySelectorAll<HTMLLinkElement>("link[rel='stylesheet']").forEach((el) => {
      const href = el.href || "";
      if (href.includes("fonts.googleapis.com") || href.includes("fonts.gstatic.com")) {
        const node = document.createElement("link");
        node.rel = "stylesheet";
        node.href = href;
        node.setAttribute("data-ai-theme", "true");
        document.head.appendChild(node);
        injected.push(node);
      }
    });

    injectedNodesRef.current = injected;

    // ── 3. Install VendyBridge on window ───────────────────────────────────
    // All methods read from bridgeRef so they always have current cart/products.
    (window as any).VendyBridge = {
      getStore: () =>
        Promise.resolve({
          name: bridgeRef.current.store.name,
          description: bridgeRef.current.store.description,
          logo_url: bridgeRef.current.store.logo_url,
          whatsapp_number: bridgeRef.current.store.whatsapp_number,
          address: bridgeRef.current.store.address,
        }),

      getProducts: (limit: number = 20) =>
        Promise.resolve(
          bridgeRef.current.products.slice(0, limit).map((p: any) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            base_price: p.base_price ?? null,
            offer_price: p.offer_price ?? null,
            // images can be plain URL strings OR responsive-image objects
            // ({variants, url, original}) — resolve every entry to a plain
            // string the AI's <img src> can actually load, same helper the
            // rest of the storefront already uses.
            images: (p.images ?? []).map((img: unknown) => getImageUrl(img as any)),
            category: p.category ?? "",
          }))
        ),

      getCategories: () =>
        Promise.resolve(
          bridgeRef.current.categories.map((c: any) => ({
            id: c.id,
            name: c.name,
            image_url: c.image_url ?? null,
          }))
        ),

      // product_detail page only — resolves to whichever product the
      // customer navigated to. null when this template isn't given one
      // (e.g. previewed outside a real product route).
      getCurrentProduct: () => {
        const p = bridgeRef.current.currentProduct;
        if (!p) return Promise.resolve(null);
        return Promise.resolve({
          id: p.id,
          slug: p.slug,
          name: p.name,
          base_price: p.base_price ?? null,
          offer_price: p.offer_price ?? null,
          images: (p.images ?? []).map((img: unknown) => getImageUrl(img as any)),
          category: p.category ?? "",
          description: p.description ?? "",
        });
      },

      addToCart: (productId: string, qty: number = 1) => {
        const { products, addToCart: addFn, store: s } = bridgeRef.current;
        const product = products.find((p: any) => p.id === productId || p.slug === productId);
        if (product) {
          addFn({
            productId: product.id,
            productName: product.name,
            productImage: getImageUrl(product.images?.[0]),
            price: Number(product.offer_price || product.base_price || 0),
            quantity: Math.max(1, qty),
            storeId: s.id,
          });
        }
        return Promise.resolve();
      },

      getCart: () =>
        Promise.resolve(
          bridgeRef.current.cart.map((item) => ({
            productId: item.productId,
            name: item.productName,
            price: item.price,
            qty: item.quantity,
            image: item.productImage,
          }))
        ),

      // Cart page only — no-op elsewhere (updateQuantity/removeItem aren't passed in)
      updateCartQty: (productId: string, qty: number) => {
        bridgeRef.current.updateQuantity?.(productId, undefined, Math.max(1, qty));
        return Promise.resolve();
      },

      removeFromCart: (productId: string) => {
        bridgeRef.current.removeItem?.(productId);
        return Promise.resolve();
      },

      navigateTo: (path: string) => {
        if (onNavigateRef.current) {
          onNavigateRef.current(path);
          return;
        }
        const { isSubdomain: sub, store: s, navigate: nav } = bridgeRef.current;
        const prefix = sub ? "" : "/" + s.slug;
        nav(prefix + path);
      },

      openWhatsApp: (msg?: string) => {
        const phone = (bridgeRef.current.store.whatsapp_number ?? "").replace(/\D/g, "");
        if (!phone) return;
        const url = "https://wa.me/" + phone + (msg ? "?text=" + encodeURIComponent(msg) : "");
        window.open(url, "_blank", "noopener,noreferrer");
      },
    };

    // ── 4. Strip <script> tags from body, collect for re-execution ─────────
    const body = doc.body;
    const pendingScripts: { src: string | null; content: string }[] = [];

    body.querySelectorAll("script").forEach((el) => {
      const src = el.getAttribute("src");
      const content = el.textContent ?? "";
      // Only allow inline scripts — external scripts violate the bridge contract
      // and are a security risk. Google Fonts CDN is allowed via <link>, not <script>.
      if (!src && content.trim()) {
        pendingScripts.push({ src: null, content });
      }
      el.remove();
    });

    // ── 5. Set body content ────────────────────────────────────────────────
    container.innerHTML = body.innerHTML;

    // ── 6. Re-execute inline scripts after DOM is populated ────────────────
    // dangerouslySetInnerHTML / innerHTML does NOT execute <script> tags.
    // We recreate them as live DOM nodes so they run against the bridge.
    for (const { content } of pendingScripts) {
      const scriptNode = document.createElement("script");
      scriptNode.textContent = content;
      container.appendChild(scriptNode);
    }

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      container.innerHTML = "";
      for (const node of injectedNodesRef.current) {
        node.remove();
      }
      injectedNodesRef.current = [];
      delete (window as any).VendyBridge;
    };
  }, [html]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} />;
}
