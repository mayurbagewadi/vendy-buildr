import type { ComponentType } from "react";
import type { StoreContextData, StoreProfileData } from "@/contexts/StoreContext";
import type { CartItem } from "@/lib/cartUtils";
import type { Product } from "@/lib/productData";
import type { ThemePreset } from "@/lib/themeRegistry";

export type ThemeStorefrontUrls = {
  home: string;
  products: string;
  categories: string;
  about: string;
  cart: string;
  checkout: string;
  product: (product: { id: string; slug?: string | null }) => string;
};

export type ThemeStorefrontActions = {
  addToCart: (item: CartItem) => void;
  updateQuantity: (productId: string, variant: string | undefined, quantity: number) => void;
  removeItem: (productId: string, variant?: string) => void;
};

export type ThemeStorefrontProps = {
  store: StoreContextData;
  products: Product[];
  categories?: Array<{
    id: string;
    name: string;
    image_url?: string | null;
    store_id?: string;
  }>;
  showInternalHeader?: boolean;
  cart?: CartItem[];
  cartCount?: number;
  cartTotal?: number;
  urls?: ThemeStorefrontUrls;
  actions?: ThemeStorefrontActions;
};

export type ThemeHeaderProps = {
  storeSlug?: string;
  storeId?: string;
};

export type ThemePreviewProps = {
  theme: {
    name: string;
    slug: string;
    description: string;
    theme_preset?: ThemePreset;
    theme_version?: string;
  };
  onInstall: () => void;
  onClose: () => void;
  installing?: boolean;
};

export type ThemeCategory = {
  id: string;
  name: string;
  image_url?: string | null;
  display_order?: number;
  store_id?: string;
  productCount?: number;
};

export type ThemeCategoriesProps = {
  store: StoreContextData;
  profile: StoreProfileData | null;
  storeSlug?: string;
  categories: ThemeCategory[];
};

export type ThemeProductsProps = {
  store: StoreContextData;
  profile: StoreProfileData | null;
  storeSlug?: string;
  products: Product[];
  categories: string[];
  selectedCategories: string[];
  priceRange: number[];
  sortBy: string;
  showFilters: boolean;
  loading: boolean;
  isError: boolean;
  onRetry: () => void;
  onCategoryToggle: (category: string) => void;
  onClearFilters: () => void;
  onPriceRangeChange: (range: number[]) => void;
  onSortChange: (sortBy: string) => void;
  onToggleFilters: () => void;
  getProductUrl: (product: Product) => string;
  navigateToProduct: (product: Product) => void;
};
export type ThemeProductDetailProps = Record<string, unknown>;
export type ThemeCartProps = Record<string, unknown>;
export type ThemeContentProps = Record<string, unknown>;

export type StorefrontThemeComponents = {
  Home?: ComponentType<ThemeStorefrontProps>;
  Products?: ComponentType<ThemeProductsProps>;
  ProductDetail?: ComponentType<ThemeProductDetailProps>;
  Cart?: ComponentType<ThemeCartProps>;
  Storefront?: ComponentType<ThemeStorefrontProps>;
  Header?: ComponentType<ThemeHeaderProps>;
  Preview?: ComponentType<ThemePreviewProps>;
  Categories?: ComponentType<ThemeCategoriesProps>;
  About?: ComponentType<ThemeContentProps>;
  Policies?: ComponentType<ThemeContentProps>;
};

export type RequiredThemePage = "Home" | "Products" | "Categories" | "ProductDetail" | "Cart";
export type OptionalThemePage = "About" | "Policies" | "Search" | "Collection";
export type ThemeOwnedPage = RequiredThemePage | OptionalThemePage;

export type CoreOwnedPage =
  | "Checkout"
  | "PaymentSuccess"
  | "Auth"
  | "Admin"
  | "OrderCreation"
  | "PaymentCallbacks";

export type ThemePluginPages = {
  required: readonly RequiredThemePage[];
  optional?: readonly OptionalThemePage[];
  coreOwned: readonly CoreOwnedPage[];
};

export type ThemePageImplementation = "theme" | "core-fallback";

export type ThemePageImplementations = Record<RequiredThemePage, ThemePageImplementation> &
  Partial<Record<OptionalThemePage, ThemePageImplementation>>;

export type ThemeCompatibility = {
  engineVersion: string;
  minCoreVersion: string;
  maxCoreVersion?: string;
  requiredFeatures?: readonly string[];
  optionalFeatures?: readonly string[];
};

export type ThemePluginManifest = {
  name: string;
  slug: string;
  description: string;
  icon: string;
  isFree: boolean;
  price: number;
  preset: ThemePreset;
};

export type ThemePluginConfigSchema = Record<string, unknown>;
export type ThemePluginAssets = Record<string, unknown>;

export type ThemePlugin = {
  id: string;
  version: string;
  engineVersion: string;
  compatibility: ThemeCompatibility;
  manifest: ThemePluginManifest;
  configSchema: ThemePluginConfigSchema;
  assets: ThemePluginAssets;
  components: StorefrontThemeComponents;
  pages: ThemePluginPages;
  pageImplementations: ThemePageImplementations;
};

export type StorefrontThemePageVariants = {
  products?: "default" | "editorial-catalog";
  cart?: "default" | "editorial-cart";
  content?: "default" | "editorial-content";
  productDetail?: "default" | "editorial-product";
};

export type StorefrontThemeRuntimeDefinition = ThemePlugin & {
  slug: string;
  template: string;
  legacyTemplates?: string[];
  cssScope: string;
  cartVariant?: "default" | "ecosoap";
  pageVariants?: StorefrontThemePageVariants;
};

export type StorefrontThemeManifest = Omit<StorefrontThemeRuntimeDefinition, "components"> & {
  components?: never;
};

export type StorefrontThemeRuntimeLoader = () => Promise<{
  default?: StorefrontThemeRuntimeDefinition;
  storefrontThemeRuntime?: StorefrontThemeRuntimeDefinition;
}>;
