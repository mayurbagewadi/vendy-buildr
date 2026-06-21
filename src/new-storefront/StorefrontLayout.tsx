import { Outlet, useLocation, useParams } from "react-router-dom";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoreProvider, useStorefront } from "@/contexts/StoreContext";
import { useAIDesignCSS } from "@/hooks/useAIDesignCSS";
import { getStorefrontThemeByTemplate } from "@/new-storefront/theme-engine/registry";

interface StorefrontLayoutProps {
  // Provided by StorefrontApp for subdomain/custom-domain routes where the slug
  // is known at app level instead of coming from the URL path.
  slug?: string;
}

const StorefrontLayout = ({ slug: slugProp }: StorefrontLayoutProps = {}) => {
  const { slug: paramSlug } = useParams<{ slug?: string }>();
  const slug = slugProp ?? paramSlug;

  return (
    <StoreProvider slug={slug}>
      <StorefrontDesignLoader />
      <StorefrontThemeScope />
    </StoreProvider>
  );
};

const StorefrontDesignLoader = () => {
  const { storeId, storeSlug } = useStorefront();
  useAIDesignCSS(storeId, storeSlug);
  return null;
};

const StorefrontThemeScope = () => {
  const { store, storeSlug, loading, errorType } = useStorefront();
  const location = useLocation();
  const activeTheme = getStorefrontThemeByTemplate(store?.storefront_template as string | null | undefined);
  const themeId = activeTheme?.cssScope;
  const debugEnabled = import.meta.env.DEV;

  if (debugEnabled) {
    console.info("[STOREFRONT_THEME_DEBUG][layout]", {
      path: location.pathname,
      loading,
      storeSlug,
      storeId: store?.id,
      storeName: store?.name,
      storefront_template: store?.storefront_template,
      storefront_theme: store?.storefront_theme,
      storefront_color_palette: store?.storefront_color_palette,
      resolvedThemeId: activeTheme?.id ?? null,
      htmlTemplate: document.documentElement.getAttribute("data-storefront-template"),
    });
  }

  if (errorType === "connection_error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-red-100 p-3">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <h1 className="mb-3 text-xl font-bold">Connection problem</h1>
          <p className="mb-5 text-muted-foreground">
            Connection problem. Please check internet and try again.
          </p>
          <Button onClick={() => window.location.reload()} className="w-full">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div data-storefront-theme={themeId}>
      <Outlet />
    </div>
  );
};

export default StorefrontLayout;
