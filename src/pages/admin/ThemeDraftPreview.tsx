import { Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import type { PublicStorefrontConfig } from "@/contexts/StoreContext";
import { getPublishedProducts, type Product } from "@/lib/productData";
import { loadStoreThemeState, type StoreThemeState } from "@/lib/storeThemeState";
import {
  getStorefrontThemeById,
  getStorefrontThemeByTemplate,
  loadStorefrontThemeRuntime,
  loadStorefrontThemeRuntimeById,
} from "@/new-storefront/theme-engine/registry";
import { buildThemeRuntimeContext } from "@/new-storefront/theme-engine/runtimeProps";
import { resolveThemeSettings } from "@/new-storefront/theme-engine/settings";
import { buildStorefrontUrls } from "@/new-storefront/theme-engine/storefrontUrls";
import type {
  StorefrontThemeRuntimeDefinition,
  ThemeStorefrontProps,
} from "@/new-storefront/theme-engine/types";

type StoreCategory = {
  id: string;
  name: string;
  image_url?: string | null;
  store_id?: string;
};

const loadCurrentStore = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("stores")
    .select("id, slug, storefront_template")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const loadPublicStoreConfig = async (storeId: string): Promise<PublicStorefrontConfig | null> => {
  const { data, error } = await (supabase as any)
    .from("public_storefront_config")
    .select("*")
    .eq("id", storeId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as PublicStorefrontConfig | null;
};

const resolveDraftRuntime = async (
  themeState: StoreThemeState | null,
  legacyTemplate: string | null | undefined
): Promise<StorefrontThemeRuntimeDefinition | null> => {
  if (themeState?.draft_theme_id && themeState.draft_theme_id !== "default") {
    return loadStorefrontThemeRuntimeById(themeState.draft_theme_id);
  }

  if (!legacyTemplate || legacyTemplate === "default") return null;
  return loadStorefrontThemeRuntime(legacyTemplate);
};

const ThemeDraftPreview = () => {
  const { cart, cartCount, cartTotal, addToCart, updateQuantity, removeItem } = useCart();
  const [store, setStore] = useState<PublicStorefrontConfig | null>(null);
  const [runtime, setRuntime] = useState<StorefrontThemeRuntimeDefinition | null>(null);
  const [themeState, setThemeState] = useState<StoreThemeState | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPreview = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const storeRow = await loadCurrentStore();
      if (!storeRow?.id) {
        setStore(null);
        setRuntime(null);
        return;
      }

      const [publicStore, nextThemeState, categoryResult, productResult] = await Promise.all([
        loadPublicStoreConfig(storeRow.id),
        loadStoreThemeState(storeRow.id),
        supabase.from("categories").select("id, name, image_url, store_id").eq("store_id", storeRow.id).order("name"),
        getPublishedProducts(storeRow.id, 16),
      ]);

      const nextRuntime = await resolveDraftRuntime(nextThemeState, storeRow.storefront_template);

      setStore(publicStore);
      setThemeState(nextThemeState);
      setRuntime(nextRuntime);
      setCategories((categoryResult.data ?? []) as StoreCategory[]);
      setProducts(productResult);
    } catch (error: any) {
      console.error("Failed to load theme draft preview:", error);
      setErrorMessage(error.message || "Could not load draft preview.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPreview();
  }, []);

  useEffect(() => {
    if (!runtime) return;
    document.documentElement.setAttribute("data-storefront-template", runtime.template);
    return () => document.documentElement.removeAttribute("data-storefront-template");
  }, [runtime]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        <span>Loading draft preview...</span>
      </div>
    );
  }

  if (errorMessage || !store || !runtime) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center">
          <h1 className="mb-2 text-xl font-semibold">Preview unavailable</h1>
          <p className="mb-5 text-sm text-muted-foreground">
            {errorMessage || "Install a runtime theme as draft before previewing."}
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/admin/online-store/themes">Back</Link>
            </Button>
            <Button onClick={loadPreview}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  const manifest =
    getStorefrontThemeById(themeState?.draft_theme_id) ??
    getStorefrontThemeByTemplate(store.storefront_template);
  const ThemeStorefront = runtime.components.Storefront;
  const draftSettings = resolveThemeSettings(runtime, themeState?.draft_settings ?? manifest?.defaultSettings ?? {});
  const storefrontUrls = buildStorefrontUrls({ slug: store.slug });
  const props: ThemeStorefrontProps = {
    store,
    products,
    categories,
    showInternalHeader: true,
    cart,
    cartCount,
    cartTotal,
    urls: storefrontUrls,
    actions: {
      addToCart,
      updateQuantity,
      removeItem,
    },
    runtime: buildThemeRuntimeContext(runtime),
    settings: draftSettings,
    page: {
      page: "home",
      settings: draftSettings,
    },
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-[100] border-b bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Draft Preview</div>
            <div className="text-xs text-muted-foreground">
              {runtime.manifest.name} draft. Customers cannot see this version until publish.
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadPreview}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload
            </Button>
            <Button size="sm" asChild>
              <Link to="/admin/online-store/themes">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Editor
              </Link>
            </Button>
          </div>
        </div>
      </div>
      <div data-storefront-theme={runtime.cssScope}>
        {ThemeStorefront ? (
          <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading theme...</div>}>
            <ThemeStorefront {...props} />
          </Suspense>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            This theme does not provide a storefront component.
          </div>
        )}
      </div>
    </div>
  );
};

export default ThemeDraftPreview;
