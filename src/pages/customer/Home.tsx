import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/customer/Header";
import Footer from "@/components/customer/Footer";
import ProductCard from "@/components/customer/ProductCard";
import CategoryCard from "@/components/customer/CategoryCard";
import { LoadingPage } from "@/components/customer/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { getPublishedProducts } from "@/lib/productData";
import type { Product as ProductType } from "@/lib/productData";
import { convertToDirectImageUrl } from "@/lib/imageUtils";
import HeroBannerCarousel from "@/components/customer/HeroBannerCarousel";

interface Product {
  id: string;
  name: string;
  category: string;
  price_range?: string;
  images: string[];
  status: string;
  created_at?: string;
}

interface Category {
  id: string;
  name: string;
  image_url?: string | null;
  store_id: string;
}

// Demo categories with images
const DEMO_CATEGORIES: Category[] = [
  {
    id: "demo-1",
    name: "Electronics",
    image_url: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400",
    store_id: "demo"
  },
  {
    id: "demo-2",
    name: "Fashion",
    image_url: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=400",
    store_id: "demo"
  },
  {
    id: "demo-3",
    name: "Home & Living",
    image_url: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=400",
    store_id: "demo"
  },
  {
    id: "demo-4",
    name: "Beauty",
    image_url: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400",
    store_id: "demo"
  },
  {
    id: "demo-5",
    name: "Sports",
    image_url: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400",
    store_id: "demo"
  },
  {
    id: "demo-6",
    name: "Books",
    image_url: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400",
    store_id: "demo"
  }
];

const Home = () => {
  // Use React Query for caching and automatic refetching
  const { data, isLoading } = useQuery({
    queryKey: ['home-data'],
    queryFn: async () => {
      // Fetch demo store first
      const { data: demoStore } = await supabase
        .from("stores")
        .select("id, name, description, logo_url, hero_banner_url, hero_banner_urls")
        .eq("slug", "demo")
        .eq("is_active", true)
        .maybeSingle();

      if (!demoStore) {
        return {
          allProducts: [],
          featuredProducts: [],
          newArrivals: [],
          categories: DEMO_CATEGORIES
        };
      }

      // Fetch products and categories in parallel for better performance
      const [publishedProducts, categoriesData] = await Promise.all([
        getPublishedProducts(demoStore.id),
        supabase
          .from("categories")
          .select("*")
          .eq("store_id", demoStore.id)
          .order("name")
          .then(res => res.data)
      ]);

      // Process products
      const sorted = [...publishedProducts].sort((a, b) => 
        new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
      );

      return {
        allProducts: publishedProducts as any,
        featuredProducts: publishedProducts.slice(0, 4) as any,
        newArrivals: sorted.slice(0, 4) as any,
        categories: (categoriesData && categoriesData.length > 0) ? categoriesData : DEMO_CATEGORIES,
        store: demoStore
      };
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
  });

  const { allProducts = [], featuredProducts = [], newArrivals = [], categories = DEMO_CATEGORIES, store } = data || {};

  if (isLoading) {
    return <LoadingPage text="Loading store..." />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Hero Banner Carousel Section */}
        {store && (
          <HeroBannerCarousel
            bannerUrls={store.hero_banner_urls && store.hero_banner_urls.length > 0 
              ? store.hero_banner_urls 
              : store.hero_banner_url 
              ? [store.hero_banner_url] 
              : []}
            storeName={store.name || "MyStore"}
            logoUrl={store.logo_url}
            storeDescription={store.description}
          />
        )}
        
        {!store && (
          <section className="bg-gradient-to-r from-primary/10 via-primary/5 to-background py-32">
            <div className="container mx-auto px-4">
              <div className="max-w-3xl mx-auto text-center">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
                  Welcome to MyStore
                </h1>
                <p className="text-xl text-muted-foreground">
                  Discover quality products at unbeatable prices. Shop now!
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Categories - Right after banner */}
        <section id="categories" className="py-20 bg-gradient-to-b from-muted/30 to-background relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                Shop by Category
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Explore our curated collections designed just for you
              </p>
            </div>
            
            {/* Horizontal Scrollable Layout */}
            <div className="relative px-4">
              <div className="flex gap-2 overflow-x-auto py-4 scrollbar-hide snap-x snap-mandatory px-4">
                {categories.map((category, index) => {
                  const productCount = allProducts.filter(p => p.category === category.name).length;
                  return (
                    <div
                      key={category.id}
                      className="flex-shrink-0 w-48 snap-center"
                      style={{
                        animationDelay: `${index * 100}ms`
                      }}
                    >
                      <CategoryCard
                        name={category.name}
                        image_url={category.image_url}
                        productCount={productCount}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Featured Products */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-2">Featured Products</h2>
                <p className="text-muted-foreground">Check out our top picks for you</p>
              </div>
              <Link to="/products">
                <Button variant="outline">
                  View All
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
            {featuredProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {featuredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    slug={product.slug}
                    name={product.name}
                    category={product.category}
                    priceRange={product.price_range || ''}
                    images={product.images}
                    status={product.status}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-12">No products available yet.</p>
            )}
          </div>
        </section>

        {/* New Arrivals */}
        {newArrivals.length > 0 && (
          <section className="py-16">
            <div className="container mx-auto px-4">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">New Arrivals</h2>
                <p className="text-muted-foreground">Fresh products just for you</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {newArrivals.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    slug={product.slug}
                    name={product.name}
                    category={product.category}
                    priceRange={product.price_range || ''}
                    images={product.images}
                    status={product.status}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="py-20 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Start Shopping?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Explore thousands of products and great deals
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/products">
                <Button size="lg" variant="secondary">
                  Browse Products
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="secondary" className="bg-background text-foreground hover:bg-background/90">
                  View Pricing Plans
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Home;
