import type { MarketplaceThemeDefinition } from "@/lib/themeRegistry";

export const ecosoapBoutiqueTheme = {
  id: "ecosoap-boutique",
  slug: "ecosoap-boutique",
  name: "EcoSoap Boutique",
  description:
    "A calm botanical storefront theme with editorial spacing, premium product cards, and conversion-focused visual hierarchy.",
  icon: "Palette",
  version: "1.0.0",
  template: "ecosoap-boutique",
  legacyTemplates: ["playful"],
  isFree: true,
  price: 0,
  preset: {
    theme: "dark",
    palette: "forest",
    heroTitle: "Nourish Your Barrier, Purely From Earth.",
    heroDescription:
      "A premium, editorial-style storefront built for artisanal skincare brands with fast product discovery and strong above-the-fold trust signals.",
  },
} satisfies MarketplaceThemeDefinition;
