import type { StorefrontThemeRuntimeDefinition } from "@/new-storefront/theme-engine/types";
import { ecosoapBoutiqueTheme } from "./theme";
import Storefront from "./Storefront";
import Header from "./Header";
import Preview from "./Preview";
export { ecosoapBoutiqueAssets } from "./assets";

export const ecosoapBoutiqueRuntimeTheme: StorefrontThemeRuntimeDefinition = {
  id: ecosoapBoutiqueTheme.id,
  slug: ecosoapBoutiqueTheme.slug,
  template: ecosoapBoutiqueTheme.template,
  legacyTemplates: ecosoapBoutiqueTheme.legacyTemplates,
  cssScope: ecosoapBoutiqueTheme.id,
  cartVariant: "ecosoap",
  pageVariants: {
    products: "editorial-catalog",
    cart: "editorial-cart",
    content: "editorial-content",
    productDetail: "editorial-product",
    checkout: "editorial-checkout",
    paymentSuccess: "editorial-payment",
  },
  components: {
    Storefront,
    Header,
    Preview,
  },
};

export { ecosoapBoutiqueTheme };
