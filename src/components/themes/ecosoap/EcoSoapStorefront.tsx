import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Award,
  Calculator,
  Eye,
  Filter,
  FlaskConical,
  HelpCircle,
  Leaf,
  Search,
  ShieldAlert,
  ShoppingBag,
  Smile,
  Sparkles,
  Star,
} from "lucide-react";
import { isStoreSpecificDomain } from "@/lib/domainUtils";
import { useCart } from "@/contexts/CartContext";

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
};

const THEME_IMAGES = [
  "/themes/ecosoap/lavender_oatmeal_soap.png",
  "/themes/ecosoap/citrus_calendula_soap.png",
  "/themes/ecosoap/activated_charcoal_soap.png",
];

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

export default function EcoSoapStorefront({ store, products, categories = [] }: EcoSoapStorefrontProps) {
  const navigate = useNavigate();
  const { addToCart, cartCount } = useCart();
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
    addToCart({
      productId: product.source.id,
      productName: product.source.name,
      productImage: product.image,
      price: product.price,
      quantity: 1,
      storeId: store.id,
    });
  };

  const showShop = activeTab === "shop";

  return (
    <div className="min-h-screen bg-[#fbfaf6] text-stone-900 antialiased">
      <header className="sticky top-0 z-40 w-full border-b border-stone-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <button onClick={() => setActiveTab("shop")} className="group flex items-center gap-2.5 text-left">
              <span className="rounded-full bg-emerald-50 p-2.5 text-emerald-700 transition-transform duration-300 group-hover:rotate-12">
                <Leaf className="h-6 w-6 stroke-[2.2]" />
              </span>
              <span>
                <span className="font-serif text-2xl font-semibold tracking-normal text-stone-900">
                  {store.name || "EcoSoap"}
                </span>
                <span className="-mt-1 block text-[10px] font-semibold uppercase tracking-widest text-emerald-800">
                  Handcrafted Organic
                </span>
              </span>
            </button>

            <nav className="hidden space-x-1 md:flex lg:space-x-2">
              {[
                ["shop", "Shop Botanicals", Leaf],
                ["soap-lab", "Soap Lab", FlaskConical],
                ["skin-guide", "AI Skin Guide", Sparkles],
                ["sustainability", "Eco Tracker", Calculator],
              ].map(([tab, label, Icon]) => (
                <button
                  key={tab as string}
                  onClick={() => setActiveTab(tab as string)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium tracking-normal transition-all ${
                    activeTab === tab
                      ? "border border-emerald-100 bg-emerald-50 text-emerald-800 shadow-sm"
                      : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                  }`}
                >
                  <Icon className="h-4 w-4 text-emerald-600" />
                  {label as string}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(isStoreSpecificDomain() ? "/cart" : `/${store.slug}/cart`)}
                className="relative rounded-full bg-stone-50 p-2.5 text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900"
                aria-label="Open shopping cart"
                data-cart-icon
              >
                <ShoppingBag className="h-5 w-5 stroke-[2]" />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </button>
              <div className="hidden items-center gap-1.5 rounded-full border border-emerald-100/50 bg-emerald-50 px-3 py-1 lg:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-medium uppercase tracking-normal text-emerald-800">100% Zero Plastic</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {showShop ? (
        <main>
          <section className="relative overflow-hidden bg-gradient-to-b from-[#fbfaf6] via-white to-[#f5f1e8] py-16 lg:py-24">
            <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
                <div className="space-y-6 text-left lg:col-span-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-emerald-900">
                    <Leaf className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Cold-Processed & Cured for 6 Weeks</span>
                  </div>
                  <h1 className="font-serif text-4xl font-medium leading-[1.12] text-stone-900 sm:text-5xl lg:text-6xl">
                    Nourish Your Barrier, <br />
                    <span className="font-normal italic text-emerald-800">Purely From Earth.</span>
                  </h1>
                  <p className="max-w-xl text-base leading-relaxed text-stone-600 sm:text-lg">
                    {store.description ||
                      "Inspired by classic botanical recipes. We hand-craft soap bars using zero synthetic chemicals, biodegradable fats, and active bio-extracts."}
                  </p>
                  <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                    <button
                      onClick={() => document.getElementById("ecosoap-products")?.scrollIntoView({ behavior: "smooth" })}
                      className="group flex items-center justify-center gap-2 rounded-full bg-stone-900 px-7 py-4 text-sm font-medium tracking-normal text-white shadow-sm transition-all hover:bg-emerald-800"
                    >
                      Explore Soap Catalog
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </button>
                    <button
                      onClick={() => setActiveTab("soap-lab")}
                      className="flex items-center justify-center rounded-full border border-stone-200 px-7 py-4 text-sm font-medium tracking-normal text-stone-800 transition-all hover:border-stone-400 hover:bg-stone-50"
                    >
                      Launch Virtual Soap Lab
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 border-t border-stone-100 pt-8">
                    {[
                      [ShieldAlert, "100% Native", "Zero Sulfates or Parabens"],
                      [Award, "Eco-Conscious", "Completely Bio-Degradable"],
                      [Smile, "Deep Curing", "Gentle Lather Structure"],
                    ].map(([Icon, title, text]) => (
                      <div key={title as string} className="space-y-1">
                        <div className="flex items-center gap-1.5 font-serif text-sm font-semibold text-stone-900">
                          <Icon className="h-4 w-4 shrink-0 text-emerald-600" />
                          <span>{title as string}</span>
                        </div>
                        <p className="text-xs text-stone-500">{text as string}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative flex justify-center lg:col-span-6">
                  <div className="relative aspect-[4/3] w-full max-w-lg rotate-1 overflow-hidden rounded-2xl border-4 border-white shadow-2xl transition-transform duration-500 hover:rotate-0">
                    <img src="/themes/ecosoap/hero_soap_banner.png" alt="EcoSoap artisanal collection" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-end bg-gradient-to-t from-emerald-50/85 via-white/20 to-transparent p-6">
                      <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-left shadow-sm backdrop-blur-sm">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700">Featured Batch</span>
                        <h3 className="font-serif text-lg font-medium text-stone-900">French Lavender & Oatmeal Meadow</h3>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -top-4 -right-2 flex -rotate-3 items-center gap-2 rounded-xl border border-stone-50 bg-white px-4 py-2 shadow-lg transition-transform hover:rotate-0 sm:right-6">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                    </span>
                    <p className="text-xs font-semibold text-stone-800">Cure Batch #942 Fully Aged</p>
                  </div>
                  <div className="absolute -bottom-6 -left-2 rotate-2 rounded-full bg-emerald-500 px-5 py-3 text-white shadow-lg transition-transform hover:rotate-0 sm:left-4">
                    <p className="text-xs font-semibold uppercase tracking-wider">Plastic-Free Shipping</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white py-16" id="ecosoap-products">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mx-auto mb-12 max-w-2xl text-center">
                <h2 className="font-serif text-3xl font-semibold text-stone-900 sm:text-4xl">Handcrafted Scent Collections</h2>
                <p className="mt-3 text-sm leading-relaxed text-stone-500 sm:text-base">
                  Every bar is crafted in cold processes, cured for at least six weeks, and presented with a premium botanical catalog experience.
                </p>
              </div>

              <div className="mb-10 flex flex-col gap-4 rounded-2xl border border-stone-100 bg-stone-50 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {categoryOptions.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-normal transition-all sm:text-sm ${
                        selectedCategory === category
                          ? "bg-stone-900 text-white shadow"
                          : "border border-stone-200/60 bg-white text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                <div className="flex max-w-xl grow flex-col gap-3 sm:flex-row lg:justify-end">
                  <div className="relative grow">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search ingredients..."
                      className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-sm transition-all placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value)}
                      className="w-full cursor-pointer appearance-none rounded-xl border border-stone-200 bg-white py-2.5 pl-4 pr-10 text-sm font-medium text-stone-700 transition-all focus:border-emerald-500 focus:outline-none sm:w-48"
                    >
                      <option value="recommended">Best Match</option>
                      <option value="price-low">Price: Low to High</option>
                      <option value="price-high">Price: High to Low</option>
                      <option value="rating">Top Rated</option>
                    </select>
                    <Filter className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                  </div>
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 py-20 text-center">
                  <HelpCircle className="mx-auto mb-4 h-12 w-12 text-stone-400" />
                  <h3 className="font-serif text-lg font-medium text-stone-800">No Botanicals Found</h3>
                  <p className="mt-2 text-sm text-stone-500">Try searching another herb or clearing filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                  {filteredProducts.map((product) => (
                    <article
                      key={product.id}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-100 bg-white text-left shadow-sm transition-all duration-300 hover:shadow-md"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-stone-50">
                        <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        <span className="absolute left-4 top-4 rounded-full border border-stone-100/55 bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-800 shadow backdrop-blur-sm">
                          {product.noteCategory} note
                        </span>
                        <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-white/10 bg-stone-900/80 px-2.5 py-1.5 text-[10px] font-bold tracking-normal text-white shadow">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span>{product.rating.toFixed(1)}</span>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-stone-900/70 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => navigate(buildProductUrl(store.slug, product.source))}
                            className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-stone-900 shadow-md hover:bg-stone-50"
                          >
                            <Eye className="h-3.5 w-3.5 text-stone-700" />
                            View Recipe
                          </button>
                        </div>
                      </div>
                      <div className="flex grow flex-col justify-between p-6">
                        <div>
                          <div className="mb-2.5 flex flex-wrap gap-1">
                            {product.skinType.map((skin) => (
                              <span key={skin} className="rounded-md border border-stone-100 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                                {skin} Skin
                              </span>
                            ))}
                          </div>
                          <h3 className="font-serif text-lg font-medium text-stone-900 transition-colors group-hover:text-emerald-800 sm:text-xl">
                            {product.name}
                          </h3>
                          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-stone-500 sm:text-sm">{product.tagline}</p>
                        </div>
                        <div className="mt-6 flex items-center justify-between border-t border-stone-50 pt-5">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">Price</p>
                            <p className="font-serif text-lg font-semibold text-stone-950">{product.priceLabel}</p>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => navigate(buildProductUrl(store.slug, product.source))}
                              className="rounded-xl border border-stone-200/50 bg-stone-50 p-2.5 text-stone-500 transition-all hover:bg-stone-100 hover:text-stone-800 md:hidden"
                              aria-label="View product details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleAddToCart(product)}
                              className="flex items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 transition-all hover:bg-emerald-600 hover:text-white"
                            >
                              <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
                              Add Bar
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      ) : (
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
      )}

      <footer className="border-t border-stone-100 bg-white py-12 text-stone-600 md:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 text-left md:grid-cols-4">
            <div className="space-y-4 md:col-span-2">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-emerald-50 p-1.5 text-emerald-700">
                  <Leaf className="h-5 w-5" />
                </div>
                <span className="font-serif text-xl font-bold text-stone-900">{store.name || "EcoSoap"}</span>
              </div>
              <p className="max-w-sm text-xs leading-relaxed text-stone-500 sm:text-sm">
                Dedicated to botanical skincare, premium store presentation, and a shared commerce backend built for repeatable storefront themes.
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900">The Saponary</h4>
              <ul className="space-y-1.5 text-xs font-medium text-stone-500">
                <li><button onClick={() => setActiveTab("shop")} className="hover:text-emerald-700">Artisanal Shop</button></li>
                <li><button onClick={() => setActiveTab("soap-lab")} className="hover:text-emerald-700">Experimental Soap Lab</button></li>
                <li><button onClick={() => setActiveTab("skin-guide")} className="hover:text-emerald-700">AI Botanical Assessment</button></li>
                <li><button onClick={() => setActiveTab("sustainability")} className="hover:text-emerald-700">Footprint Trackers</button></li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900">Green Assurances</h4>
              <ul className="space-y-1.5 text-xs text-stone-500">
                {["100% Vegan & Cruelty-Free", "Rainforest Alliance Palm Oil", "Sustainably Sourced Wood Trays"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col justify-between border-t border-stone-100 pt-8 text-left text-xs text-stone-400 sm:flex-row">
            <p>(c) {new Date().getFullYear()} {store.name || "EcoSoap Studio"}. All Rights Reserved.</p>
            <div className="mt-2 flex gap-4 sm:mt-0">
              <a href="#" className="hover:text-stone-600">Privacy Charter</a>
              <a href="#" className="hover:text-stone-600">Zero Waste Vow</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
