import { useStorefront } from "@/contexts/StoreContext";
import { getStorefrontThemeByTemplate } from "./registry";
import type { StorefrontThemePageVariants } from "./types";

export type StorefrontThemePageKey = keyof StorefrontThemePageVariants;

export const useActiveStorefrontTheme = () => {
  const { store } = useStorefront();
  return getStorefrontThemeByTemplate(store?.storefront_template);
};

export const getStorefrontPageVariant = (
  template: string | null | undefined,
  page: StorefrontThemePageKey
) => getStorefrontThemeByTemplate(template)?.pageVariants?.[page] ?? "default";
