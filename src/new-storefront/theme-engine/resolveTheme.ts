import { useEffect, useState } from "react";
import { useStorefront } from "@/contexts/StoreContext";
import { getStorefrontThemeByTemplate, loadStorefrontThemeRuntime } from "./registry";
import type { StorefrontThemePageVariants, StorefrontThemeRuntimeDefinition } from "./types";

export type StorefrontThemePageKey = keyof StorefrontThemePageVariants;
export type CoreOwnedPageVariantKey = "checkout" | "paymentSuccess";

export const useActiveStorefrontTheme = () => {
  const { store } = useStorefront();
  return getStorefrontThemeByTemplate(store?.storefront_template);
};

export const useActiveStorefrontThemeRuntime = () => {
  const { store } = useStorefront();
  const template = store?.storefront_template;
  const [runtime, setRuntime] = useState<StorefrontThemeRuntimeDefinition | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRuntime(null);

    if (!template || template === "default") {
      setLoading(false);
      return;
    }

    setLoading(true);
    loadStorefrontThemeRuntime(template)
      .then((loadedRuntime) => {
        if (!cancelled) setRuntime(loadedRuntime);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [template]);

  return { runtime, loading };
};

export const getStorefrontPageVariant = (
  template: string | null | undefined,
  page: StorefrontThemePageKey | CoreOwnedPageVariantKey
) => {
  if (page === "checkout" || page === "paymentSuccess") return "default";

  return getStorefrontThemeByTemplate(template)?.pageVariants?.[page] ?? "default";
};
