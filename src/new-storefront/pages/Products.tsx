import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Filter } from "lucide-react";

import { ErrorDisplay } from "@/components/customer/ErrorDisplay";
import Header from "@/components/customer/Header";
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

interface ProductsProps {
  slug?: string;
}

const Products = ({ slug: slugProp }: ProductsProps = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { slug: slugParam } = useParams<{ slug?: string }>();
  const slug = slugProp || slugParam;

  const { store, profile, loading: storeLoading } = useStorefront();
  const storeAny = store as any;

  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<number[]>([0, 10000]);
  const [sortBy, setSortBy] = useState<string>("newest");
  const [showFilters, setShowFilters] = useState(false);

  const isSubdomain = isStoreSpecificDomain();

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
  };

  const clearFilters = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("category");
    setSearchParams(newParams);
    setSelectedCategories([]);
    setPriceRange([0, 10000]);
    setSortBy("newest");
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
