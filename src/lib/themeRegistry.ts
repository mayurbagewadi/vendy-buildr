import type { PaletteId } from "@/lib/colorPalettes";
import { ecosoapBoutiqueTheme } from "@/new-storefront/themes/ecosoap-boutique/theme";

export type StorefrontThemeMode = "dark" | "light" | "system";
export type StorefrontTemplateId = string;

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
  legacyTemplates?: StorefrontTemplateId[];
  preset: ThemePreset;
  isFree: boolean;
  price: number;
};

export const DEFAULT_STOREFRONT_TEMPLATE: StorefrontTemplateId = "default";

export const ECOSOAP_THEME: MarketplaceThemeDefinition = ecosoapBoutiqueTheme;

export const BUILT_IN_MARKETPLACE_THEMES = [ECOSOAP_THEME] as const;

export const getThemeBySlug = (slug: string) =>
  BUILT_IN_MARKETPLACE_THEMES.find((theme) => theme.slug === slug) ?? null;

export const getThemeByTemplate = (template: string | null | undefined) =>
  BUILT_IN_MARKETPLACE_THEMES.find(
    (theme) =>
      theme.template === template ||
      theme.legacyTemplates?.includes(template ?? "")
  ) ?? null;

export const resolveThemeTemplate = (slug: string): StorefrontTemplateId =>
  getThemeBySlug(slug)?.template ?? DEFAULT_STOREFRONT_TEMPLATE;

export const resolveThemePreset = (
  slug: string,
  preset?: ThemePreset | null
): ThemePreset => preset ?? getThemeBySlug(slug)?.preset ?? ECOSOAP_THEME.preset;
