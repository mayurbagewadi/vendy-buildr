import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Filter, HelpCircle, Leaf } from "lucide-react";
import { isStoreSpecificDomain } from "@/lib/domainUtils";
import { generateGeneralInquiryMessage, openWhatsApp } from "@/lib/whatsappUtils";
import { useToast } from "@/hooks/use-toast";
import FeaturedProductsSection from "@/new-storefront/themes/ecosoap-boutique/sections/FeaturedProductsSection";
import FooterSection from "@/new-storefront/themes/ecosoap-boutique/sections/FooterSection";
import HeaderSection from "@/new-storefront/themes/ecosoap-boutique/sections/HeaderSection";
import HeroSection from "@/new-storefront/themes/ecosoap-boutique/sections/HeroSection";
import PageRenderer from "@/new-storefront/theme-engine/PageRenderer";
import { CustomHTMLSection } from "@/new-storefront/components/CustomHTMLSection";
import type { CartItem } from "@/lib/cartUtils";
import type {
  ThemeSectionInstance,
  ThemeStorefrontActions,
  ThemeStorefrontUrls,
} from "@/new-storefront/theme-engine/types";

type PlatformProduct = {
  id: string;
  slug?: string;
  name: string;
  category: string;
  price_range?: string;
  images: string[];
  status: string;
  base_price?: number;
  offer_price?: number;
  variants?: Array<{ name: string; price: number; offer_price?: number; stock?: number | string | null }>;
  stock?: number | null;
  created_at?: string;
};

type StoreData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  whatsapp_number: string | null;
  address: string | null;
};

type StoreCategory = {
  id: string;
  name: string;
};

type EcoSoapProduct = {
  id: string;
  slug?: string;
  name: string;
  tagline: string;
  noteCategory: "floral" | "citrus" | "earthy" | "unscented";
  storeCategory: string;
  price: number;
  priceLabel: string;
  rating: number;
  image: string;
  ingredients: string[];
  skinType: string[];
  description: string;
  source: PlatformProduct;
};

type EcoSoapStorefrontProps = {
  store: StoreData;
  products: PlatformProduct[];
  categories?: StoreCategory[];
  showInternalHeader?: boolean;
  cart?: CartItem[];
  cartCount?: number;
  cartTotal?: number;
  urls?: ThemeStorefrontUrls;
  actions?: ThemeStorefrontActions;
  settings?: Record<string, unknown>;
  sections?: ThemeSectionInstance[];
};

const THEME_IMAGES = [
  "/themes/ecosoap/lavender_oatmeal_soap.png",
  "/themes/ecosoap/citrus_calendula_soap.png",
  "/themes/ecosoap/activated_charcoal_soap.png",
];

const IMPLEMENTED_SECTION_ORDER = ["header", "hero", "featured-products", "footer"] as const;

const toEcoNoteCategory = (category: string): EcoSoapProduct["noteCategory"] => {
  const value = category.toLowerCase();
  if (value.includes("flower") || value.includes("floral") || value.includes("lavender")) return "floral";
  if (value.includes("citrus") || value.includes("orange") || value.includes("lemon")) return "citrus";
  if (value.includes("sensitive") || value.includes("baby") || value.includes("unscented")) return "unscented";
  return "earthy";
};

const resolvePrice = (product: PlatformProduct) => {
  const variantOffer = product.variants?.find((variant) => variant.offer_price && variant.offer_price > 0);
  const variantPrice = product.variants?.[0]?.price;
  const price = product.offer_price || product.base_price || variantOffer?.offer_price || variantPrice || 0;
  return {
    value: Number(price) || 0,
    label: price ? `Rs. ${Number(price).toFixed(2)}` : product.price_range || "Price on request",
  };
};

const buildProductUrl = (storeSlug: string, product: PlatformProduct) => {
  const productIdentifier = product.slug || product.id;
  return isStoreSpecificDomain()
    ? `/products/${productIdentifier}`
    : `/${storeSlug}/products/${productIdentifier}`;
};

const settingText = (settings: Record<string, unknown> | undefined, key: string, fallback: string) => {
  const value = settings?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
};

const adaptProducts = (products: PlatformProduct[]): EcoSoapProduct[] =>
  products.map((product, index) => {
    const price = resolvePrice(product);
    const storeCategory = product.category || "Uncategorized";
    const noteCategory = toEcoNoteCategory(storeCategory);
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      tagline: product.price_range || `${product.category || "Botanical"} formulation with a clean, handmade finish`,
      noteCategory,
      storeCategory,
      price: price.value,
      priceLabel: price.label,
      rating: 4.7 + (index % 3) * 0.1,
      image: product.images?.[0] || THEME_IMAGES[index % THEME_IMAGES.length],
      ingredients: [product.category || "Botanical blend", "Cold process oils", "Natural extract"],
      skinType: noteCategory === "unscented" ? ["Sensitive", "Baby"] : noteCategory === "citrus" ? ["Normal", "Dull"] : ["Dry", "Daily"],
      description: product.price_range || "Handcrafted product prepared for a premium botanical storefront experience.",
      source: product,
    };
  });

export default function EcoSoapStorefront({
  store,
  products,
  categories = [],
  showInternalHeader = true,
  cart = [],
  cartCount = 0,
  cartTotal = 0,
  urls,
  actions,
  settings,
  sections,
}: EcoSoapStorefrontProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("shop");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("recommended");

  const ecoProducts = useMemo(() => adaptProducts(products), [products]);

  const categoryOptions = useMemo(() => {
    const productCategories = new Set(
      products
        .map((product) => product.category)
        .filter((category): category is string => Boolean(category?.trim()))
    );

    const merchantCategories = categories
      .map((category) => category.name)
      .filter((name) => name && productCategories.has(name));

    const fallbackCategories = Array.from(productCategories);
    const uniqueCategories = Array.from(new Set(merchantCategories.length > 0 ? merchantCategories : fallbackCategories));

    return ["all", ...uniqueCategories];
  }, [categories, products]);

  const filteredProducts = useMemo(() => {
    let result = [...ecoProducts];
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter((product) =>
        [product.name, product.tagline, product.storeCategory, product.noteCategory, ...product.ingredients]
          .join(" ")
          .toLowerCase()
          .includes(term)
      );
    }
    if (selectedCategory !== "all") result = result.filter((product) => product.storeCategory === selectedCategory);
    if (sortBy === "price-low") result.sort((a, b) => a.price - b.price);
    if (sortBy === "price-high") result.sort((a, b) => b.price - a.price);
    if (sortBy === "rating") result.sort((a, b) => b.rating - a.rating);
    return result;
  }, [ecoProducts, searchTerm, selectedCategory, sortBy]);

  const handleAddToCart = (product: EcoSoapProduct) => {
    actions?.addToCart({
      productId: product.source.id,
      productName: product.source.name,
      productImage: product.image,
      price: product.price,
      quantity: 1,
      storeId: store.id,
    });
  };

  const showShop = activeTab === "shop";
  const isSubdomain = isStoreSpecificDomain();
  const homeLink = urls?.home ?? (isSubdomain ? "/" : `/${store.slug}`);
  const productsLink = urls?.products ?? (isSubdomain ? "/products" : `/${store.slug}/products`);
  const categoriesLink = urls?.categories ?? (isSubdomain ? "/categories" : `/${store.slug}/categories`);
  const aboutLink = urls?.about ?? (isSubdomain ? "/about" : `/${store.slug}/about`);
  const cartLink = urls?.cart ?? (isSubdomain ? "/cart" : `/${store.slug}/cart`);
  const checkoutLink = urls?.checkout ?? (isSubdomain ? "/checkout" : `/${store.slug}/checkout`);
  const updateCartQuantity = actions?.updateQuantity ?? (() => undefined);
  const removeCartItem = actions?.removeItem ?? (() => undefined);
  const copy = {
    headerBadge: settingText(settings, "header_badge_text", "Handcrafted Organic"),
    headerTrust: settingText(settings, "header_trust_text", "100% Zero Plastic"),
    heroBadge: settingText(settings, "hero_badge_text", "Cold-Processed & Cured for 6 Weeks"),
    heroTitle: settingText(settings, "hero_title", "Nourish Your Barrier"),
    heroHighlight: settingText(settings, "hero_highlight_text", "Purely From Earth."),
    heroDescription: settingText(
      settings,
      "hero_description",
      store.description ||
        "Inspired by classic botanical recipes. We hand-craft soap bars using zero synthetic chemicals, biodegradable fats, and active bio-extracts."
    ),
    heroPrimaryCta: settingText(settings, "hero_primary_cta", "Explore Soap Catalog"),
    heroSecondaryCta: settingText(settings, "hero_secondary_cta", "Launch Virtual Soap Lab"),
    heroImage: settingText(settings, "hero_image", "/themes/ecosoap/hero_soap_banner.png"),
    heroFeaturedBadge: settingText(settings, "hero_featured_badge", "Featured Batch"),
    heroFeaturedTitle: settingText(settings, "hero_featured_title", "French Lavender & Oatmeal Meadow"),
    heroSideBadgeTop: settingText(settings, "hero_side_badge_top", "Cure Batch #942 Fully Aged"),
    heroSideBadgeBottom: settingText(settings, "hero_side_badge_bottom", "Plastic-Free Shipping"),
    productsHeading: settingText(settings, "products_heading", "Handcrafted Scent Collections"),
    productsSubheading: settingText(
      settings,
      "products_subheading",
      "Every bar is crafted in cold processes, cured for at least six weeks, and presented with a premium botanical catalog experience."
    ),
    emptyProductsTitle: settingText(settings, "empty_products_title", "No Botanicals Found"),
    emptyProductsDescription: settingText(settings, "empty_products_description", "Try searching another herb or clearing filters."),
    footerDescription: settingText(
      settings,
      "footer_description",
      "Dedicated to botanical skincare, premium store presentation, and a shared commerce backend built for repeatable storefront themes."
    ),
    footerMenuTitle: settingText(settings, "footer_menu_title", "The Saponary"),
    footerAssurancesTitle: settingText(settings, "footer_assurances_title", "Green Assurances"),
    footerPrivacyLabel: settingText(settings, "footer_privacy_label", "Privacy Charter"),
    footerSustainabilityLabel: settingText(settings, "footer_sustainability_label", "Zero Waste Vow"),
  };
  const navItems = [
    {
      href: homeLink,
      label: "Home",
      active: location.pathname === homeLink,
      activeClass: "border border-emerald-100 bg-emerald-50 text-emerald-800 shadow-sm",
      icon: null,
      iconClass: "",
    },
    {
      href: productsLink,
      label: "Products",
      active: location.pathname.startsWith(productsLink),
      activeClass: "border border-emerald-100 bg-emerald-50 text-emerald-800 shadow-sm",
      icon: Leaf,
      iconClass: "text-emerald-600",
    },
    {
      href: categoriesLink,
      label: "Categories",
      active: location.pathname.startsWith(categoriesLink),
      activeClass: "border border-emerald-100 bg-emerald-50 text-emerald-800 shadow-sm",
      icon: Filter,
      iconClass: "text-emerald-600",
    },
    {
      href: aboutLink,
      label: "About",
      active: location.pathname === aboutLink,
      activeClass: "border border-emerald-100 bg-emerald-50 text-emerald-800 shadow-sm",
      icon: HelpCircle,
      iconClass: "text-emerald-600",
    },
  ];

  const handleWhatsApp = async () => {
    const message = generateGeneralInquiryMessage();
    const result = await openWhatsApp(message, undefined, store.id);

    if (!result.success) {
      toast({
        title: "WhatsApp Not Configured",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const renderSection = (section: ThemeSectionInstance) => {
    if (section.type === "header") {
      if (!showInternalHeader) return null;

      return (
        <HeaderSection
          store={store}
          homeLink={homeLink}
          cartLink={cartLink}
          checkoutLink={checkoutLink}
          navItems={navItems}
          copy={copy}
          cart={cart}
          cartCount={cartCount}
          cartTotal={cartTotal}
          order={section.order}
          onWhatsApp={handleWhatsApp}
          updateCartQuantity={updateCartQuantity}
          removeCartItem={removeCartItem}
        />
      );
    }

    if (section.type === "hero") {
      return <HeroSection copy={copy} onOpenSoapLab={() => setActiveTab("soap-lab")} />;
    }

    if (section.type === "featured-products") {
      return (
        <FeaturedProductsSection
          copy={copy}
          categoryOptions={categoryOptions}
          selectedCategory={selectedCategory}
          searchTerm={searchTerm}
          sortBy={sortBy}
          products={filteredProducts}
          onSelectCategory={setSelectedCategory}
          onSearchChange={setSearchTerm}
          onSortChange={setSortBy}
          onViewProduct={(product) => navigate(urls?.product(product.source) ?? buildProductUrl(store.slug, product.source))}
          onAddToCart={handleAddToCart}
        />
      );
    }

    if (section.type === "footer") {
      return <FooterSection store={store} copy={copy} onSelectTab={setActiveTab} />;
    }

    if (section.type === "custom-html") {
      const htmlContent = typeof section.settings?.html_content === "string"
        ? section.settings.html_content
        : "";
      return <CustomHTMLSection htmlContent={htmlContent} />;
    }

    return null;
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#fbfaf6] text-stone-900 antialiased">
      {showShop ? (
        <main className="contents">
          <PageRenderer
            sections={sections}
            defaultSectionTypes={IMPLEMENTED_SECTION_ORDER}
            renderSection={renderSection}
          />
        </main>
      ) : (
        <>
          <PageRenderer
            sections={sections}
            defaultSectionTypes={["header"]}
            renderSection={renderSection}
          />
          <main className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-stone-100 bg-white p-8 text-left shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">{activeTab.replace("-", " ")}</p>
              <h1 className="mt-3 font-serif text-3xl font-medium text-stone-900">EcoSoap experience module</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-500">
                This theme module keeps the reference navigation and visual language while core commerce remains connected to the platform backend.
              </p>
              <button
                onClick={() => setActiveTab("shop")}
                className="mt-6 rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-800"
              >
                Back to Shop
              </button>
            </div>
          </main>
          <PageRenderer
            sections={sections}
            defaultSectionTypes={["footer"]}
            renderSection={renderSection}
          />
        </>
      )}

    </div>
  );
}
