import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye, Filter, HelpCircle, Leaf, Search, Star } from "lucide-react";

import { ErrorDisplay } from "@/components/customer/ErrorDisplay";
import Header from "@/new-storefront/components/StorefrontHeader";
import { LoadingSpinner } from "@/components/customer/LoadingSpinner";
import ProductCard from "@/components/customer/ProductCard";
import StoreFooter from "@/components/customer/StoreFooter";
import { SEOHead } from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useStorefront } from "@/contexts/StoreContext";
import { isStoreSpecificDomain } from "@/lib/domainUtils";
import { getPublishedProducts, type Product } from "@/lib/productData";
import { getStoreCanonicalUrl } from "@/lib/seo/canonicalUrl";
import { ECOSOAP_THEME, getThemeByTemplate } from "@/lib/themeRegistry";

interface ProductsProps {
  slug?: string;
}

const Products = ({ slug: slugProp }: ProductsProps = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { slug: slugParam } = useParams<{ slug?: string }>();
  const slug = slugProp || slugParam;
  const navigate = useNavigate();

  const { store, profile, loading: storeLoading } = useStorefront();
  const storeAny = store as any;

  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<number[]>([0, 10000]);
  const [sortBy, setSortBy] = useState<string>("newest");
  const [showFilters, setShowFilters] = useState(false);

  const isSubdomain = isStoreSpecificDomain();
  const activeMarketplaceTheme = getThemeByTemplate(storeAny?.storefront_template);
  const isEcoSoapTheme = activeMarketplaceTheme?.id === ECOSOAP_THEME.id;

  const {
    data: allProducts = [],
    isLoading: productsLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["store-products", store?.id],
    queryFn: () => getPublishedProducts((store as any).id, 50),
    enabled: !!store?.id,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  if (import.meta.env.DEV || localStorage.getItem("dd_theme_debug") === "1") {
    console.info("[STOREFRONT_THEME_DEBUG][products]", {
      slug,
      storeId: store?.id,
      storeSlug: storeAny?.slug,
      storefront_template: storeAny?.storefront_template,
      resolvedThemeId: activeMarketplaceTheme?.id || null,
      isEcoSoapTheme,
      productsCount: allProducts.length,
    });
  }

  const loading = storeLoading || productsLoading;

  useEffect(() => {
    const unique = [...new Set(allProducts.map((p: Product) => p.category))].filter(Boolean) as string[];
    setCategories(unique);
  }, [allProducts]);

  useEffect(() => {
    const categoryParam = searchParams.get("category");
    if (categoryParam && categories.includes(categoryParam)) {
      setSelectedCategories([categoryParam]);
    }
  }, [searchParams, categories]);

  useEffect(() => {
    if (!allProducts || allProducts.length === 0) {
      setFilteredProducts([]);
      return;
    }

    let filtered = [...allProducts];

    const searchParam = searchParams.get("search");
    if (searchParam) {
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(searchParam.toLowerCase()));
    }

    const categoryParam = searchParams.get("category");
    if (categoryParam) {
      filtered = filtered.filter((p) => p.category === categoryParam);
    } else if (selectedCategories.length > 0) {
      filtered = filtered.filter((p) => selectedCategories.includes(p.category));
    }

    if (priceRange[0] > 0 || priceRange[1] < 10000) {
      filtered = filtered.filter((p) => {
        const minPrice = p.basePrice || (p.variants?.length ? Math.min(...p.variants.map((v) => v.price)) : 0);
        const maxPrice = p.variants?.length
          ? Math.max(...p.variants.map((v) => v.price))
          : (p.basePrice || 0);
        return maxPrice >= priceRange[0] && minPrice <= priceRange[1];
      });
    }

    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => {
          const priceA = a.basePrice || (a.variants?.length ? a.variants[0].price : 0);
          const priceB = b.basePrice || (b.variants?.length ? b.variants[0].price : 0);
          return priceA - priceB;
        });
        break;
      case "price-high":
        filtered.sort((a, b) => {
          const priceA = a.basePrice || (a.variants?.length ? a.variants[0].price : 0);
          const priceB = b.basePrice || (b.variants?.length ? b.variants[0].price : 0);
          return priceB - priceA;
        });
        break;
      case "name":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "newest":
      default:
        break;
    }

    setFilteredProducts(filtered);
  }, [allProducts, selectedCategories, priceRange, sortBy, searchParams]);

  const handleCategoryToggle = (category: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("category");
    setSearchParams(newParams);
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  }

  const clearFilters = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("category");
    setSearchParams(newParams);
    setSelectedCategories([]);
    setPriceRange([0, 10000]);
    setSortBy("newest");
  };

  const getProductUrl = (product: Product) => {
    const productIdentifier = (product as any).slug || product.id;
    return isSubdomain
      ? `/products/${productIdentifier}`
      : `/${slug}/products/${productIdentifier}`;
  };

  const getEcoCategory = (category: string | null | undefined) => {
    const value = (category || "").toLowerCase();
    if (value.includes("flower") || value.includes("floral") || value.includes("lavender")) return "floral";
    if (value.includes("citrus") || value.includes("orange") || value.includes("lemon")) return "citrus";
    if (value.includes("sensitive") || value.includes("baby") || value.includes("unscented")) return "unscented";
    return "earthy";
  };

  const getProductPriceLabel = (product: Product) => {
    const variantOffer = product.variants?.find((variant) => variant.offer_price && variant.offer_price > 0);
    const variantPrice = product.variants?.[0]?.price;
    const price = product.offerPrice || product.offer_price || product.basePrice || product.base_price || variantOffer?.offer_price || variantPrice;
    return price ? `Rs. ${Number(price).toFixed(2)}` : product.priceRange || product.price_range || "Price on request";
  };

  if (isEcoSoapTheme) {
    return (
      <div className="flex min-h-screen flex-col bg-[#fbfaf6] text-stone-900">
        {store && (
          <SEOHead
            title={`Botanicals | ${storeAny.name}`}
            description={storeAny.description || `Shop handcrafted botanical collections at ${storeAny.name}.`}
            canonical={getStoreCanonicalUrl(storeAny.slug, storeAny.subdomain, storeAny.custom_domain) + "/products"}
            image={storeAny.logo_url || undefined}
          />
        )}
        <Header storeSlug={slug} storeId={store?.id || undefined} />

        <main className="flex-1">
          <section className="border-b border-stone-100 bg-gradient-to-b from-[#fbfaf6] via-white to-[#f5f1e8] py-14">
            <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
              <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-emerald-800">
                <Leaf className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-widest">EcoSoap Boutique</span>
              </div>
              <h1 className="font-serif text-4xl font-semibold text-stone-950 md:text-5xl">Handcrafted Scent Collections</h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-stone-500 sm:text-base">
                Every product is presented with a premium botanical catalog experience while your store keeps the same fast product engine underneath.
              </p>
            </div>
          </section>

          <section className="bg-white py-12">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {loading ? (
                <div className="py-20">
                  <LoadingSpinner size="lg" text="Loading botanicals..." />
                </div>
              ) : isError ? (
                <div className="py-20">
                  <ErrorDisplay
                    title="Failed to load botanicals"
                    message="Something went wrong. Please try again."
                    onRetry={refetch}
                  />
                </div>
              ) : (
                <>
                  <div className="mb-10 flex flex-col gap-4 rounded-2xl border border-stone-100 bg-stone-50 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-1.5">
                      {["all", ...categories].map((category) => {
                        const active = category === "all" ? selectedCategories.length === 0 && !searchParams.get("category") : selectedCategories.includes(category) || searchParams.get("category") === category;
                        return (
                          <button
                            key={category}
                            onClick={() => {
                              if (category === "all") clearFilters();
                              else handleCategoryToggle(category);
                            }}
                            className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-normal transition-all sm:text-sm ${
                              active
                                ? "bg-stone-900 text-white shadow"
                                : "border border-stone-200/60 bg-white text-stone-600 hover:text-stone-900"
                            }`}
                          >
                            {category}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex max-w-xl grow flex-col gap-3 sm:flex-row lg:justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setShowFilters(!showFilters)}
                        className="rounded-xl border-stone-200 lg:hidden"
                      >
                        <Filter className="mr-2 h-4 w-4" />
                        Filters
                      </Button>
                      <div className="relative">
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger className="w-full rounded-xl border-stone-200 bg-white sm:w-48">
                            <SelectValue placeholder="Sort by" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="newest">Best Match</SelectItem>
                            <SelectItem value="price-low">Price: Low to High</SelectItem>
                            <SelectItem value="price-high">Price: High to Low</SelectItem>
                            <SelectItem value="name">Name: A-Z</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-8 lg:flex-row">
                    <aside className={`lg:w-64 ${showFilters ? "block" : "hidden lg:block"}`}>
                      <Card className="sticky top-24 rounded-2xl border-stone-100 bg-white shadow-sm">
                        <CardContent className="p-6">
                          <div className="mb-6 flex items-center justify-between">
                            <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-stone-900">
                              <Filter className="h-5 w-5 text-emerald-700" />
                              Refine
                            </h2>
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                              Clear
                            </Button>
                          </div>

                          {categories.length > 0 && (
                            <div className="mb-6">
                              <Label className="mb-3 block text-sm font-semibold text-stone-900">Collections</Label>
                              <div className="space-y-3">
                                {categories.map((category) => (
                                  <div key={category} className="flex items-center gap-2">
                                    <Checkbox
                                      id={`eco-${category}`}
                                      checked={selectedCategories.includes(category)}
                                      onCheckedChange={() => handleCategoryToggle(category)}
                                    />
                                    <label htmlFor={`eco-${category}`} className="cursor-pointer text-sm text-stone-500">
                                      {category}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <Label className="mb-3 block text-sm font-semibold text-stone-900">Price Range</Label>
                            <div className="px-2">
                              <Slider
                                min={0}
                                max={10000}
                                step={100}
                                value={priceRange}
                                onValueChange={setPriceRange}
                                className="mb-4"
                              />
                              <div className="flex justify-between text-sm text-stone-500">
                                <span>Rs. {priceRange[0]}</span>
                                <span>Rs. {priceRange[1]}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </aside>

                    <div className="flex-1">
                      <div className="mb-6 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Catalog</p>
                          <p className="mt-1 text-sm text-stone-500">Showing {filteredProducts.length} botanicals</p>
                        </div>
                        <Search className="h-5 w-5 text-stone-300" />
                      </div>

                      {filteredProducts.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 py-20 text-center">
                          <HelpCircle className="mx-auto mb-4 h-12 w-12 text-stone-400" />
                          <h3 className="font-serif text-lg font-medium text-stone-800">No Botanicals Found</h3>
                          <p className="mt-2 text-sm text-stone-500">Try another collection or clear filters.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                          {filteredProducts.map((product, index) => {
                            const image = product.images?.[0] || "/placeholder.svg";
                            const ecoCategory = getEcoCategory(product.category);
                            return (
                              <article
                                key={product.id}
                                className="group flex flex-col overflow-hidden rounded-2xl border border-stone-100 bg-white text-left shadow-sm transition-all duration-300 hover:border-emerald-100 hover:shadow-md"
                              >
                                <button
                                  onClick={() => navigate(getProductUrl(product))}
                                  className="relative aspect-[4/3] overflow-hidden bg-stone-50 text-left"
                                >
                                  <img
                                    src={image}
                                    alt={product.name}
                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    loading={index < 6 ? "eager" : "lazy"}
                                  />
                                  <span className="absolute left-4 top-4 rounded-full border border-stone-100/55 bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-800 shadow backdrop-blur-sm">
                                    {ecoCategory} note
                                  </span>
                                  <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-white/10 bg-stone-900/80 px-2.5 py-1.5 text-[10px] font-bold tracking-normal text-white shadow">
                                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                    <span>{(4.7 + (index % 3) * 0.1).toFixed(1)}</span>
                                  </div>
                                  <div className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-stone-900/70 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
                                    <span className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-stone-900 shadow-md">
                                      <Eye className="h-3.5 w-3.5 text-stone-700" />
                                      View Recipe
                                    </span>
                                  </div>
                                </button>

                                <div className="flex grow flex-col justify-between p-6">
                                  <div>
                                    <div className="mb-2.5 flex flex-wrap gap-1">
                                      {[ecoCategory === "unscented" ? "Sensitive" : "Daily", ecoCategory === "citrus" ? "Bright" : "Botanical"].map((skin) => (
                                        <span key={skin} className="rounded-md border border-stone-100 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                                          {skin} Skin
                                        </span>
                                      ))}
                                    </div>
                                    <h3 className="font-serif text-lg font-medium text-stone-900 transition-colors group-hover:text-emerald-800 sm:text-xl">
                                      {product.name}
                                    </h3>
                                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-stone-500 sm:text-sm">
                                      {product.priceRange || product.price_range || `${product.category || "Botanical"} formulation with a clean, handmade finish`}
                                    </p>
                                  </div>
                                  <div className="mt-6 flex items-center justify-between border-t border-stone-50 pt-5">
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">Price</p>
                                      <p className="font-serif text-lg font-semibold text-stone-950">{getProductPriceLabel(product)}</p>
                                    </div>
                                    <Button
                                      onClick={() => navigate(getProductUrl(product))}
                                      className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-600 hover:text-white"
                                    >
                                      View
                                    </Button>
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </main>

        {store ? (
          <StoreFooter
            storeName={storeAny.name}
            storeDescription={storeAny.description}
            whatsappNumber={storeAny.whatsapp_number}
            phone={profile?.phone}
            email={profile?.email}
            address={storeAny.address}
            facebookUrl={storeAny.facebook_url}
            instagramUrl={storeAny.instagram_url}
            twitterUrl={storeAny.twitter_url}
            youtubeUrl={storeAny.youtube_url}
            linkedinUrl={storeAny.linkedin_url}
            socialLinks={storeAny.social_links}
            policies={storeAny.policies}
          />
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      {store && (
        <SEOHead
          title={`Products | ${storeAny.name}`}
          description={storeAny.description || `Shop all products at ${storeAny.name}. Browse our full collection with easy WhatsApp ordering.`}
          canonical={getStoreCanonicalUrl(storeAny.slug, storeAny.subdomain, storeAny.custom_domain) + "/products"}
          image={storeAny.logo_url || undefined}
        />
      )}
      <Header storeSlug={slug} storeId={store?.id || undefined} />

      <main className="container mx-auto flex-1 px-4 py-8">
        {loading ? (
          <div className="py-20">
            <LoadingSpinner size="lg" text="Loading products..." />
          </div>
        ) : isError ? (
          <div className="py-20">
            <ErrorDisplay
              title="Failed to load products"
              message="Something went wrong. Please try again."
              onRetry={refetch}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-8 lg:flex-row">
            <aside data-ai="filter-sidebar" className={`lg:w-64 ${showFilters ? "block" : "hidden lg:block"}`}>
              <Card data-ai="filter-card" className="sticky top-24">
                <CardContent className="p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <h2 data-ai="filter-heading" className="flex items-center gap-2 text-lg font-bold text-foreground">
                      <Filter className="h-5 w-5" />
                      Filters
                    </h2>
                    <Button
                      data-ai="clear-filters-button"
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-xs"
                    >
                      Clear All
                    </Button>
                  </div>

                  {categories.length > 0 && (
                    <div data-ai="categories-section" className="mb-6">
                      <Label data-ai="categories-label" className="mb-3 block text-sm font-semibold">
                        Categories
                      </Label>
                      <div data-ai="category-checkboxes" className="space-y-3">
                        {categories.map((category) => (
                          <div data-ai="category-item" key={category} className="flex items-center gap-2">
                            <Checkbox
                              id={category}
                              checked={selectedCategories.includes(category)}
                              onCheckedChange={() => handleCategoryToggle(category)}
                            />
                            <label htmlFor={category} className="cursor-pointer text-sm text-muted-foreground">
                              {category}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div data-ai="price-range-section">
                    <Label data-ai="price-range-label" className="mb-3 block text-sm font-semibold">
                      Price Range
                    </Label>
                    <div className="px-2">
                      <Slider
                        data-ai="price-range-slider"
                        min={0}
                        max={10000}
                        step={100}
                        value={priceRange}
                        onValueChange={setPriceRange}
                        className="mb-4"
                      />
                      <div data-ai="price-range-values" className="flex justify-between text-sm text-muted-foreground">
                        <span>Rs. {priceRange[0]}</span>
                        <span>Rs. {priceRange[1]}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </aside>

            <div data-ai="products-grid" className="flex-1">
              <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h1 data-ai="products-heading" className="text-2xl font-bold text-foreground">
                    All Products
                  </h1>
                  <p data-ai="products-count" className="text-muted-foreground">
                    Showing {filteredProducts.length} products
                  </p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <Button
                    data-ai="filter-toggle-mobile"
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex-1 lg:hidden"
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Filters
                  </Button>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger data-ai="sort-button" className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="price-low">Price: Low to High</SelectItem>
                      <SelectItem value="price-high">Price: High to Low</SelectItem>
                      <SelectItem value="name">Name: A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 gap-x-7 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredProducts.map((product, index) => (
                    <ProductCard
                      key={product.id}
                    {...product}
                    storeSlug={isSubdomain ? undefined : slug}
                    priorityImage={index < 8}
                  />
                ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <p className="mb-4 text-muted-foreground">No products found matching your filters</p>
                  <Button onClick={clearFilters} variant="outline">
                    Clear Filters
                  </Button>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>

      {store ? (
        <StoreFooter
          storeName={storeAny.name}
          storeDescription={storeAny.description}
          whatsappNumber={storeAny.whatsapp_number}
          phone={profile?.phone}
          email={profile?.email}
          address={storeAny.address}
          facebookUrl={storeAny.facebook_url}
          instagramUrl={storeAny.instagram_url}
          twitterUrl={storeAny.twitter_url}
          youtubeUrl={storeAny.youtube_url}
          linkedinUrl={storeAny.linkedin_url}
          socialLinks={storeAny.social_links}
          policies={storeAny.policies}
        />
      ) : (
        <footer className="border-t border-border bg-muted">
          <div className="container mx-auto px-4 py-12 text-center">
            <p className="text-muted-foreground">&copy; {new Date().getFullYear()} All rights reserved.</p>
          </div>
        </footer>
      )}
    </div>
  );
};

export default Products;
