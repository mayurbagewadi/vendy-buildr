import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "@/components/customer/Header";
import Footer from "@/components/customer/Footer";
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
import { useProductData } from "@/hooks/useProductData";
import type { Product } from "@/lib/productData";

const Products = () => {
  const [searchParams] = useSearchParams();
  const { products: allProducts, loading, error, refresh } = useProductData(true);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<number[]>([0, 10000]);
  const [sortBy, setSortBy] = useState<string>("newest");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    // Extract unique categories
    const uniqueCategories = [...new Set(allProducts.map((p: Product) => p.category))].filter(Boolean) as string[];
    setCategories(uniqueCategories);

    // Check for URL params
    const categoryParam = searchParams.get("category");
    const searchParam = searchParams.get("search");

    if (categoryParam) {
      setSelectedCategories([categoryParam]);
    }

    let filtered = [...allProducts];

    // Apply category filter
    if (categoryParam) {
      filtered = filtered.filter(p => p.category === categoryParam);
    }

    // Apply search filter
    if (searchParam) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchParam.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  }, [searchParams, allProducts]);

  useEffect(() => {
    let filtered = [...allProducts];

    // Category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(p => selectedCategories.includes(p.category));
    }

    // Price filter
    filtered = filtered.filter(p => {
      const minPrice = p.basePrice || (p.variants?.length ? Math.min(...p.variants.map(v => v.price)) : 0);
      const maxPrice = p.variants?.length 
        ? Math.max(...p.variants.map(v => v.price))
        : (p.basePrice || 0);
      
      return maxPrice >= priceRange[0] && minPrice <= priceRange[1];
    });

    // Sorting
    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => {
          const priceA = a.basePrice || 0;
          const priceB = b.basePrice || 0;
          return priceA - priceB;
        });
        break;
      case "price-high":
        filtered.sort((a, b) => {
          const priceA = a.basePrice || 0;
          const priceB = b.basePrice || 0;
          return priceB - priceA;
        });
        break;
      case "name":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "newest":
      default:
        // Already in newest first order from localStorage
        break;
    }

    setFilteredProducts(filtered);
  }, [allProducts, selectedCategories, priceRange, sortBy]);

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setPriceRange([0, 10000]);
    setSortBy("newest");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} {...product} />
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

      <Footer />
    </div>
  );
};

export default Products;
