import { useEffect, useState } from "react";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/customer/Header";
import StoreFooter from "@/components/customer/StoreFooter";
import ProductCard from "@/components/customer/ProductCard";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { LoadingSpinner } from "@/components/customer/LoadingSpinner";
import { ErrorDisplay } from "@/components/customer/ErrorDisplay";
import { getPublishedProducts } from "@/lib/productData";
import type { Product } from "@/lib/productData";
import { isStoreSpecificDomain } from "@/lib/domainUtils";

interface ProductsProps {
  slug?: string;
}

const Products = ({ slug: slugProp }: ProductsProps = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { slug: slugParam } = useParams<{ slug?: string }>();
  const slug = slugProp || slugParam;
  const navigate = useNavigate();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<number[]>([0, 10000]);
  const [sortBy, setSortBy] = useState<string>("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeData, setStoreData] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);

  // Determine if we're on a store-specific domain (subdomain or custom domain)
  const isSubdomain = isStoreSpecificDomain();

  // Fetch store data and products if accessing via /:slug/products
  useEffect(() => {
    const loadStoreDataAndProducts = async () => {
      if (!slug) return;

      try {
        setLoading(true);
        setError(null);

        const { data: store } = await supabase
          .from("stores")
          .select("*")
          .eq("slug", slug)
          .eq("is_active", true)
          .maybeSingle();

        if (store) {
          setStoreId(store.id);
          setStoreData(store);

          // Fetch profile data for contact information
          const { data: profile } = await supabase
            .from("profiles")
            .select("phone, email")
            .eq("user_id", store.user_id)
            .maybeSingle();

          if (profile) {
            setProfileData(profile);
          }

          // Fetch products for this store
          const products = await getPublishedProducts(store.id);
          setAllProducts(products);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load products');
      } finally {
        setLoading(false);
      }
    };

    loadStoreDataAndProducts();
  }, [slug]);

  const refresh = async () => {
    if (storeId) {
      try {
        const products = await getPublishedProducts(storeId);
        setAllProducts(products);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reload products');
      }
    }
  };

  // Extract categories whenever products change
  useEffect(() => {
    const uniqueCategories = [...new Set(allProducts.map((p: Product) => p.category))].filter(Boolean) as string[];
    setCategories(uniqueCategories);
  }, [allProducts]);

  // Handle URL parameters and reload on window focus
  useEffect(() => {
    const categoryParam = searchParams.get("category");
    if (categoryParam && categories.includes(categoryParam)) {
      setSelectedCategories([categoryParam]);
    }
    
    // Reload products when window regains focus
    const handleFocus = () => {
      refresh();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [searchParams, categories, refresh]);

  // Filter and sort products
  useEffect(() => {
    if (!allProducts || allProducts.length === 0) {
      setFilteredProducts([]);
      return;
    }

    let filtered = [...allProducts];

    // Filter by store if accessing via /:slug/products
    if (storeId) {
      filtered = filtered.filter(p => p.store_id === storeId);
    }

    // Apply URL-based search filter
    const searchParam = searchParams.get("search");
    if (searchParam) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchParam.toLowerCase())
      );
    }

    // Apply category filter (from URL param or user selection)
    const categoryParam = searchParams.get("category");
    if (categoryParam) {
      filtered = filtered.filter(p => p.category === categoryParam);
    } else if (selectedCategories.length > 0) {
      filtered = filtered.filter(p => selectedCategories.includes(p.category));
    }

    // Apply price filter
    if (priceRange[0] > 0 || priceRange[1] < 10000) {
      filtered = filtered.filter(p => {
        const minPrice = p.basePrice || (p.variants?.length ? Math.min(...p.variants.map(v => v.price)) : 0);
        const maxPrice = p.variants?.length 
          ? Math.max(...p.variants.map(v => v.price))
          : (p.basePrice || 0);
        
        return maxPrice >= priceRange[0] && minPrice <= priceRange[1];
      });
    }

    // Apply sorting
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
  }, [allProducts, selectedCategories, priceRange, sortBy, searchParams, storeId]);

  const handleCategoryToggle = (category: string) => {
    // Clear the URL category parameter to allow manual selection
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('category');
    setSearchParams(newParams);

    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const clearFilters = () => {
    // Clear URL parameters
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('category');
    setSearchParams(newParams);

    setSelectedCategories([]);
    setPriceRange([0, 10000]);
    setSortBy("newest");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header storeSlug={slug} />

      <main className="flex-1 container mx-auto px-4 py-8">
        {loading ? (
          <div className="py-20">
            <LoadingSpinner size="lg" text="Loading products..." />
          </div>
        ) : error ? (
          <div className="py-20">
            <ErrorDisplay 
              title="Failed to load products"
              message={error}
              onRetry={refresh}
            />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <aside className={`lg:w-64 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <Card className="sticky top-24">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    Filters
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-xs"
                  >
                    Clear All
                  </Button>
                </div>

                {/* Categories */}
                {categories.length > 0 && (
                  <div className="mb-6">
                    <Label className="text-sm font-semibold mb-3 block">Categories</Label>
                    <div className="space-y-3">
                      {categories.map((category) => (
                        <div key={category} className="flex items-center gap-2">
                          <Checkbox
                            id={category}
                            checked={selectedCategories.includes(category)}
                            onCheckedChange={() => handleCategoryToggle(category)}
                          />
                          <label
                            htmlFor={category}
                            className="text-sm text-muted-foreground cursor-pointer"
                          >
                            {category}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price Range */}
                <div>
                  <Label className="text-sm font-semibold mb-3 block">
                    Price Range
                  </Label>
                  <div className="px-2">
                    <Slider
                      min={0}
                      max={10000}
                      step={100}
                      value={priceRange}
                      onValueChange={setPriceRange}
                      className="mb-4"
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>₹{priceRange[0]}</span>
                      <span>₹{priceRange[1]}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Products Grid */}
          <div className="flex-1">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">All Products</h1>
                <p className="text-muted-foreground">
                  Showing {filteredProducts.length} products
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden flex-1"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-[180px]">
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

            {/* Products Grid */}
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} {...product} storeSlug={isSubdomain ? undefined : slug} />
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground mb-4">No products found matching your filters</p>
                <Button onClick={clearFilters} variant="outline">
                  Clear Filters
                </Button>
              </Card>
            )}
          </div>
        </div>
        )}
      </main>

      {storeData ? (
        <StoreFooter
          storeName={storeData.name}
          storeDescription={storeData.description}
          whatsappNumber={storeData.whatsapp_number}
          phone={profileData?.phone}
          email={profileData?.email}
          address={storeData.address}
          facebookUrl={storeData.facebook_url}
          instagramUrl={storeData.instagram_url}
          twitterUrl={storeData.twitter_url}
          youtubeUrl={storeData.youtube_url}
          linkedinUrl={storeData.linkedin_url}
          socialLinks={storeData.social_links}
          policies={storeData.policies}
        />
      ) : (
        <footer className="bg-muted border-t border-border">
          <div className="container mx-auto px-4 py-12 text-center">
            <p className="text-muted-foreground">&copy; {new Date().getFullYear()} All rights reserved.</p>
          </div>
        </footer>
      )}
    </div>
  );
};

export default Products;
