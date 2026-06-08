import type { PaletteId } from "@/lib/colorPalettes";

export type StorefrontThemeMode = "dark" | "light" | "system";
export type StorefrontTemplateId = "default" | "playful";

export type ThemePreset = {
  theme: StorefrontThemeMode;
  palette: PaletteId;
  heroTitle: string;
  heroDescription: string;
};

export type MarketplaceThemeDefinition = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  template: StorefrontTemplateId;
  preset: ThemePreset;
  isFree: boolean;
  price: number;
};

export const DEFAULT_STOREFRONT_TEMPLATE: StorefrontTemplateId = "default";

export const ECOSOAP_THEME: MarketplaceThemeDefinition = {
  id: "ecosoap-boutique",
  slug: "ecosoap-boutique",
  name: "EcoSoap Boutique",
  description:
    "A calm botanical storefront theme with editorial spacing, premium product cards, and conversion-focused visual hierarchy.",
  icon: "Palette",
  version: "1.0.0",
  template: "playful",
  isFree: true,
  price: 0,
  preset: {
    theme: "dark",
    palette: "forest",
    heroTitle: "Nourish Your Barrier, Purely From Earth.",
    heroDescription:
      "A premium, editorial-style storefront built for artisanal skincare brands with fast product discovery and strong above-the-fold trust signals.",
  },
};

export const BUILT_IN_MARKETPLACE_THEMES = [ECOSOAP_THEME] as const;

export const getThemeBySlug = (slug: string) =>
  BUILT_IN_MARKETPLACE_THEMES.find((theme) => theme.slug === slug) ?? null;

export const getThemeByTemplate = (template: string | null | undefined) =>
  BUILT_IN_MARKETPLACE_THEMES.find((theme) => theme.template === template) ?? null;

export const resolveThemeTemplate = (slug: string): StorefrontTemplateId =>
  getThemeBySlug(slug)?.template ?? DEFAULT_STOREFRONT_TEMPLATE;

export const resolveThemePreset = (
  slug: string,
  preset?: ThemePreset | null
): ThemePreset => preset ?? getThemeBySlug(slug)?.preset ?? ECOSOAP_THEME.preset;
