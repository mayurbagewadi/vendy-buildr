import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/customer/Header";
import StoreFooter from "@/components/customer/StoreFooter";
import ProductCard from "@/components/customer/ProductCard";
import CategoryCard from "@/components/customer/CategoryCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getPublishedProducts } from "@/lib/productData";
import type { Product as ProductType } from "@/lib/productData";

interface Product {
  id: string;
  name: string;
  category: string;
  price_range?: string;
  images: string[];
  status: string;
  created_at?: string;
}

interface StoreData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  hero_banner_url: string | null;
  whatsapp_number: string | null;
}

interface Category {
  id: string;
  name: string;
  image_url?: string | null;
  store_id: string;
}

const Store = () => {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<StoreData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoreData();
  }, [slug]);

  const loadStoreData = async () => {
    try {
      setLoading(true);

      // Fetch store data
      const { data: storeData, error: storeError } = await supabase
        .from("stores")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (storeError) throw storeError;
      if (!storeData) {
        toast({
          title: "Store not found",
          description: "The store you're looking for doesn't exist or is inactive.",
          variant: "destructive",
        });
        return;
      }

      setStore(storeData);

      // Fetch categories for this store
      const { data: categoriesData } = await supabase
        .from("categories")
        .select("*")
        .eq("store_id", storeData.id)
        .order("name");

      if (categoriesData) {
        setCategories(categoriesData);
      }

      // Fetch published products for this store
      const publishedProducts = await getPublishedProducts(storeData.id);
      setProducts(publishedProducts as any);
    } catch (error: any) {
      console.error("Error loading store:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">Store Not Found</h1>
        <p className="text-muted-foreground mb-6">The store you're looking for doesn't exist.</p>
        <Link to="/">
          <Button>Go Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header storeSlug={store.slug} />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-primary/10 via-primary/5 to-background py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              {store.logo_url && (
                <img 
                  src={store.logo_url} 
                  alt={store.name}
                  className="h-24 w-24 mx-auto mb-6 rounded-full object-cover"
                />
              )}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
                {store.name}
              </h1>
              {store.description && (
                <p className="text-xl text-muted-foreground mb-8">
                  {store.description}
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {store.whatsapp_number && (
                  <Button size="lg" className="w-full sm:w-auto">
                    Contact on WhatsApp
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section - Right after banner */}
        {categories.length > 0 && (
          <section className="py-20 bg-gradient-to-b from-primary/5 via-muted/30 to-background relative overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
            
            <div className="container mx-auto px-4 relative z-10">
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                  Explore Our Collections
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Discover amazing products across different categories
                </p>
              </div>
              
              {/* Horizontal Scrollable Layout */}
              <div className="relative px-4">
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory px-4">
                  {categories.map((category, index) => {
                    const productCount = products.filter(p => p.category === category.name && p.status === 'published').length;
                    return (
                      <div 
                        key={category.id}
                        className="flex-shrink-0 w-48 transform transition-all duration-300 hover:scale-105 hover:z-10 snap-center"
                        style={{
                          animationDelay: `${index * 100}ms`
                        }}
                      >
                        <CategoryCard
                          name={category.name}
                          image_url={category.image_url}
                          productCount={productCount}
                          slug={store?.slug}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Products Section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground mb-2">Products</h2>
              <p className="text-muted-foreground mb-8">
                {products.length === 0 
                  ? "No products available yet. Check back soon!"
                  : "Browse our collection"}
              </p>
            </div>
            {products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {products.map((product) => (
                  <ProductCard 
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    category={product.category}
                    priceRange={product.price_range || ''}
                    images={product.images}
                    status={product.status}
                    storeSlug={store.slug}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  This store is being set up. Products will be available soon.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      <StoreFooter 
        storeName={store.name}
        storeDescription={store.description}
        whatsappNumber={store.whatsapp_number}
      />
    </div>
  );
};

export default Store;