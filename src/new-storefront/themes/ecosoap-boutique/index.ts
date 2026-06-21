import type { StorefrontThemeRuntimeDefinition } from "@/new-storefront/theme-engine/types";
import { ecosoapBoutiqueTheme } from "./theme";
import "./theme.css";
import Storefront from "./Storefront";
import Products from "./Products";
import Cart from "./Cart";
import ProductDetail from "./ProductDetail";
import Header from "./Header";
import Preview from "./Preview";
import Categories from "./Categories";
import { ecosoapBoutiqueAssets } from "./assets";
export { ecosoapBoutiqueAssets };

const ecosoapBoutiqueComponents = {
  Home: Storefront,
  Storefront,
  Products,
  Cart,
  ProductDetail,
  Header,
  Preview,
  Categories,
};

export const ecosoapBoutiqueRuntimeTheme: StorefrontThemeRuntimeDefinition = {
  id: ecosoapBoutiqueTheme.id,
  version: ecosoapBoutiqueTheme.version,
  engineVersion: "1.0.0",
  compatibility: {
    engineVersion: "1.0.0",
    minCoreVersion: "1.0.0",
    maxCoreVersion: "1.x",
    requiredFeatures: ["store-context", "cart-context", "theme-runtime-loader"],
    optionalFeatures: ["theme-preview", "category-page-override"],
  },
  slug: ecosoapBoutiqueTheme.slug,
  template: ecosoapBoutiqueTheme.template,
  legacyTemplates: ecosoapBoutiqueTheme.legacyTemplates,
  manifest: {
    name: ecosoapBoutiqueTheme.name,
    slug: ecosoapBoutiqueTheme.slug,
    description: ecosoapBoutiqueTheme.description,
    icon: ecosoapBoutiqueTheme.icon,
    isFree: ecosoapBoutiqueTheme.isFree,
    price: ecosoapBoutiqueTheme.price,
    preset: ecosoapBoutiqueTheme.preset,
  },
  configSchema: {},
  assets: ecosoapBoutiqueAssets,
  pages: {
    required: ["Home", "Products", "Categories", "ProductDetail", "Cart"],
    optional: ["About", "Policies", "Search", "Collection"],
    coreOwned: ["Checkout", "PaymentSuccess", "Auth", "Admin", "OrderCreation", "PaymentCallbacks"],
  },
  pageImplementations: {
    Home: "theme",
    Products: "theme",
    Categories: "theme",
    ProductDetail: "theme",
    Cart: "theme",
    About: "core-fallback",
    Policies: "core-fallback",
  },
  cssScope: ecosoapBoutiqueTheme.id,
  cartVariant: "ecosoap",
  pageVariants: {
    products: "editorial-catalog",
    cart: "editorial-cart",
    content: "editorial-content",
    productDetail: "editorial-product",
  },
  components: ecosoapBoutiqueComponents,
};

export const storefrontThemeRuntime = ecosoapBoutiqueRuntimeTheme;
export default ecosoapBoutiqueRuntimeTheme;
export { ecosoapBoutiqueTheme };
