import type {
  StorefrontThemeManifest,
  StorefrontThemeRuntimeDefinition,
  StorefrontThemeRuntimeLoader,
} from "@/new-storefront/theme-engine/types";
import {
  ecosoapBoutiqueTheme,
  ecosoapBoutiqueThemeBlockSchema,
  ecosoapBoutiqueThemeDefaultSettings,
  ecosoapBoutiqueThemeSectionSchema,
  ecosoapBoutiqueThemeSettingsSchema,
} from "./ecosoap-boutique/theme";

export const STOREFRONT_THEME_MANIFESTS: StorefrontThemeManifest[] = [
  {
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
    configSchema: ecosoapBoutiqueThemeSettingsSchema,
    sectionSchema: ecosoapBoutiqueThemeSectionSchema,
    blockSchema: ecosoapBoutiqueThemeBlockSchema,
    defaultSettings: ecosoapBoutiqueThemeDefaultSettings,
    assets: {},
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
  },
];

const STOREFRONT_THEME_LOADERS: Record<string, StorefrontThemeRuntimeLoader> = {
  [ecosoapBoutiqueTheme.template]: () => import("./ecosoap-boutique"),
};

const runtimeCache = new Map<string, Promise<StorefrontThemeRuntimeDefinition | null>>();
const THEME_COMPONENT_BY_PAGE = {
  Home: "Storefront",
  Products: "Products",
  Categories: "Categories",
  ProductDetail: "ProductDetail",
  Cart: "Cart",
  About: "About",
  Policies: "Policies",
} as const;

const validateThemeRuntime = (
  manifest: StorefrontThemeManifest,
  runtime: StorefrontThemeRuntimeDefinition | null
) => {
  if (!runtime) return null;
  if (runtime.id !== manifest.id || runtime.template !== manifest.template) return null;
  if (runtime.version !== manifest.version) return null;
  if (runtime.compatibility.engineVersion !== manifest.compatibility.engineVersion) return null;

  for (const page of manifest.pages.required) {
    if (manifest.pageImplementations[page] !== "theme") continue;
    const componentKey = THEME_COMPONENT_BY_PAGE[page];
    if (!runtime.components[componentKey]) return null;
  }

  for (const page of manifest.pages.optional ?? []) {
    if (manifest.pageImplementations[page] !== "theme") continue;
    const componentKey = THEME_COMPONENT_BY_PAGE[page];
    if (!runtime.components[componentKey]) return null;
  }

  return runtime;
};

export const getStorefrontThemeBySlug = (slug: string | null | undefined) =>
  STOREFRONT_THEME_MANIFESTS.find((theme) => theme.slug === slug) ?? null;

export const getStorefrontThemeByTemplate = (template: string | null | undefined) => {
  if (!template || template === "default") return null;

  return (
    STOREFRONT_THEME_MANIFESTS.find(
      (theme) =>
        theme.template === template ||
        theme.legacyTemplates?.includes(template)
    ) ?? null
  );
};

export const loadStorefrontThemeRuntime = (
  template: string | null | undefined
): Promise<StorefrontThemeRuntimeDefinition | null> => {
  const manifest = getStorefrontThemeByTemplate(template);
  if (!manifest) return Promise.resolve(null);

  const loader = STOREFRONT_THEME_LOADERS[manifest.template];
  if (!loader) return Promise.resolve(null);

  const cached = runtimeCache.get(manifest.template);
  if (cached) return cached;

  const runtime = loader().then((module) => {
    const loaded = module.storefrontThemeRuntime ?? module.default ?? null;
    return validateThemeRuntime(manifest, loaded);
  });

  runtimeCache.set(manifest.template, runtime);
  return runtime;
};
