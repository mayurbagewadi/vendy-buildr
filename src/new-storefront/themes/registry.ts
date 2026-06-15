import type { StorefrontThemeRuntimeDefinition } from "@/new-storefront/theme-engine/types";
import { ecosoapBoutiqueRuntimeTheme } from "./ecosoap-boutique";

export const STOREFRONT_THEMES: StorefrontThemeRuntimeDefinition[] = [
  ecosoapBoutiqueRuntimeTheme,
];

export const getStorefrontThemeBySlug = (slug: string | null | undefined) =>
  STOREFRONT_THEMES.find((theme) => theme.slug === slug) ?? null;

export const getStorefrontThemeByTemplate = (template: string | null | undefined) => {
  if (!template || template === "default") return null;

  return (
    STOREFRONT_THEMES.find(
      (theme) =>
        theme.template === template ||
        theme.legacyTemplates?.includes(template)
    ) ?? null
  );
};
