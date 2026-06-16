import type { ComponentType } from "react";
import type { StoreContextData, StoreProfileData } from "@/contexts/StoreContext";
import type { Product } from "@/lib/productData";
import type { ThemePreset } from "@/lib/themeRegistry";

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

export type StorefrontThemeComponents = {
  Storefront?: ComponentType<ThemeStorefrontProps>;
  Header?: ComponentType<ThemeHeaderProps>;
  Preview?: ComponentType<ThemePreviewProps>;
  Categories?: ComponentType<ThemeCategoriesProps>;
};

export type StorefrontThemePageVariants = {
  products?: "default" | "editorial-catalog";
  cart?: "default" | "editorial-cart";
  content?: "default" | "editorial-content";
  productDetail?: "default" | "editorial-product";
  checkout?: "default" | "editorial-checkout";
  paymentSuccess?: "default" | "editorial-payment";
};

export type StorefrontThemeRuntimeDefinition = {
  id: string;
  slug: string;
  template: string;
  legacyTemplates?: string[];
  cssScope: string;
  cartVariant?: "default" | "ecosoap";
  pageVariants?: StorefrontThemePageVariants;
  components: StorefrontThemeComponents;
};
