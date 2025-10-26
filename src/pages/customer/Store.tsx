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
  address: string | null;
  social_links: {
    facebook?: string | null;
    instagram?: string | null;
    twitter?: string | null;
  } | null;
  policies: {
    returnPolicy?: string | null;
    shippingPolicy?: string | null;
    termsConditions?: string | null;
    deliveryAreas?: string | null;
  } | null;
}

interface ProfileData {
  phone: string | null;
  email: string | null;
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
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
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

      setStore({
        ...storeData,
        social_links: storeData.social_links as any,
        policies: storeData.policies as any,
      });

      // Fetch profile data for contact information
      const { data: profileData } = await supabase
        .from("profiles")
        .select("phone, email")
        .eq("user_id", storeData.user_id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
      }

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
      
      // Featured products (first 4)
      setFeaturedProducts(publishedProducts.slice(0, 4) as any);
      
      // New arrivals (last 4 sorted by creation date)
      const sorted = [...publishedProducts].sort((a, b) => 
        new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
      );
      setNewArrivals(sorted.slice(0, 4) as any);
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
      <Header storeSlug={store.slug} storeId={store.id} />
      
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
                <Link to={`/store/${store.slug}/products`}>
                  <Button size="lg" className="w-full sm:w-auto">
                    Start Shopping
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link to={`/store/${store.slug}/products`}>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Browse Categories
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section - Right after banner */}
        {categories.length > 0 && (
          <section className="py-20 bg-gradient-to-b from-muted/30 to-background relative overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 left-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
            
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

        {/* Featured Products */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-2">Featured Products</h2>
                <p className="text-muted-foreground">Check out our top picks for you</p>
              </div>
              <Link to={`/store/${store.slug}/products`}>
                <Button variant="outline">
                  See All
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
            {featuredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {featuredProducts.map((product) => (
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
              <p className="text-center text-muted-foreground py-12">No products available yet.</p>
            )}
          </div>
        </section>

        {/* New Arrivals */}
        {newArrivals.length > 0 && (
          <section className="py-16">
            <div className="container mx-auto px-4">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-foreground mb-2">New Arrivals</h2>
                  <p className="text-muted-foreground">Fresh products just for you</p>
                </div>
                <Link to={`/store/${store.slug}/products`}>
                  <Button variant="outline">
                    See All
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {newArrivals.map((product) => (
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
              Explore our full collection of amazing products
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to={`/store/${store.slug}/products`}>
                <Button size="lg" variant="secondary">
                  Browse All Products
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              {store.whatsapp_number && (
                <a 
                  href={`https://wa.me/${store.whatsapp_number.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="lg" variant="secondary" className="bg-background text-foreground hover:bg-background/90">
                    Contact on WhatsApp
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </section>
      </main>

      <StoreFooter 
        storeName={store.name}
        storeDescription={store.description}
        whatsappNumber={store.whatsapp_number}
        phone={profile?.phone}
        email={profile?.email}
        address={store.address}
        socialLinks={store.social_links}
        policies={store.policies}
      />
    </div>
  );
};

export default Store;