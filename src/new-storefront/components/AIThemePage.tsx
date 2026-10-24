import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CartItem } from "@/lib/cartUtils";
import type { StoreContextData } from "@/contexts/StoreContext";
import { AIThemeRenderer } from "@/new-storefront/components/AIThemeRenderer";

// Every page type Build Theme can generate, EXCEPT home (which stays on its
// own existing store_ai_themes wiring in Store.tsx — untouched, unchanged).
// Checkout/PaymentSuccess are intentionally not in this list — never AI-built.
export type AIThemePageType = "products" | "categories" | "product_detail" | "cart" | "about" | "policies";

interface UseAIThemePageArgs {
  store: StoreContextData | null | undefined;
  isSubdomain: boolean;
  products?: any[];
  categories?: any[];
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  updateQuantity?: (productId: string, variant: string | undefined, quantity: number) => void;
  removeItem?: (productId: string, variant?: string) => void;
  currentProduct?: any; // product_detail only
}

// Shared "does this store have an AI-built version of THIS page?" check,
// reused by every new-storefront page except Store.tsx (home keeps its own
// existing logic) and Checkout/PaymentSuccess (never AI-built).
//
// Usage — call at the top of the page, before any existing early return
// (marketplace theme, default UI), and bail out first if it resolves:
//
//   const aiPage = useAIThemePage("products", { store, isSubdomain, products, categories, cart, addToCart });
//   if (aiPage) return aiPage;
//   ...rest of the page, completely unchanged...
//
// Returns `null` when the page should render its normal default/marketplace
// UI (AI theme is off for this store, or this specific page was never
// generated) — the caller's `if (aiPage) return aiPage;` falls through as-is.
// Returns JSX otherwise: a small loading placeholder while the one query
// resolves (only for stores that already have ai_theme_enabled — the
// common case of AI theme being off never waits on anything), or the
// rendered AI page once it's known.
export function useAIThemePage(
  pageType: AIThemePageType,
  args: UseAIThemePageArgs
): JSX.Element | null {
  const { store, isSubdomain, products, categories, cart, addToCart, updateQuantity, removeItem, currentProduct } = args;

  const { data: pageRow, isLoading } = useQuery({
    queryKey: ["ai-theme-page", store?.id, pageType],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_ai_theme_pages")
        .select("published_html")
        .eq("store_id", store!.id)
        .eq("page_type", pageType)
        .maybeSingle();
      return data;
    },
    enabled: !!store?.id && !!store?.ai_theme_enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  if (!store?.ai_theme_enabled) return null;
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const html = pageRow?.published_html ?? null;
  if (!html) return null;

  return (
    <AIThemeRenderer
      html={html}
      store={store}
      products={products ?? []}
      categories={categories ?? []}
      cart={cart}
      addToCart={addToCart}
      updateQuantity={updateQuantity}
      removeItem={removeItem}
      currentProduct={currentProduct}
      isSubdomain={isSubdomain}
    />
  );
}
