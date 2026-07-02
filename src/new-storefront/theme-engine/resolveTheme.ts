import { useEffect, useState } from "react";
import { useStorefront } from "@/contexts/StoreContext";
import {
  getStorefrontThemeById,
  getStorefrontThemeByTemplate,
  loadStorefrontThemeRuntime,
  loadStorefrontThemeRuntimeById,
} from "./registry";
import type { StorefrontThemePageVariants, StorefrontThemeRuntimeDefinition } from "./types";

export type StorefrontThemePageKey = keyof StorefrontThemePageVariants;
export type CoreOwnedPageVariantKey = "checkout" | "paymentSuccess";

export const useActiveStorefrontTheme = () => {
  const { store } = useStorefront();
  const publishedThemeId = store?.theme_state?.published_theme_id;

  if (publishedThemeId && publishedThemeId !== "default") {
    return getStorefrontThemeById(publishedThemeId);
  }

  return getStorefrontThemeByTemplate(store?.storefront_template);
};

export const useActiveStorefrontThemeRuntime = () => {
  const { store } = useStorefront();
  const publishedThemeId = store?.theme_state?.published_theme_id;
  const template = store?.storefront_template;
  const [runtime, setRuntime] = useState<StorefrontThemeRuntimeDefinition | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRuntime(null);

    if (publishedThemeId && publishedThemeId !== "default") {
      setLoading(true);
      loadStorefrontThemeRuntimeById(publishedThemeId)
        .then((loadedRuntime) => {
          if (!cancelled) setRuntime(loadedRuntime);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }

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
  }, [publishedThemeId, template]);

  return { runtime, loading };
};

export const getStorefrontPageVariant = (
  template: string | null | undefined,
  page: StorefrontThemePageKey | CoreOwnedPageVariantKey
) => {
  if (page === "checkout" || page === "paymentSuccess") return "default";

  return getStorefrontThemeByTemplate(template)?.pageVariants?.[page] ?? "default";
};
