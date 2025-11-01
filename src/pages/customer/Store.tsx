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
import { convertToDirectImageUrl } from "@/lib/imageUtils";
import HeroBannerCarousel from "@/components/customer/HeroBannerCarousel";
import { isStoreSpecificDomain } from "@/lib/domainUtils";

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
  hero_banner_urls: string[] | null;
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

interface StoreProps {
  slug?: string;
}

const Store = ({ slug: slugProp }: StoreProps = {}) => {
  const { slug: slugParam } = useParams<{ slug?: string }>();
  const slug = slugProp || slugParam;
  const [store, setStore] = useState<StoreData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Determine if we're on a store-specific domain (subdomain or custom domain)
  const isSubdomain = isStoreSpecificDomain();
  // Build links based on domain type
  const productsLink = isSubdomain ? '/products' : `/${slug}/products`;

  useEffect(() => {
    loadStoreData();
  }, [slug]);

  const loadStoreData = async () => {
    try {
      setLoading(true);

      // Determine if we're using subdomain or custom domain lookup
      const domainInfo = isStoreSpecificDomain();
      let storeQuery = supabase
        .from("stores")
        .select("*")
        .eq("is_active", true);

      // Query by subdomain or custom_domain field based on domain type
      if (domainInfo && slug) {
        // If slug looks like a domain (contains dots), query by custom_domain or subdomain
        if (slug.includes('.')) {
          storeQuery = storeQuery.or(`custom_domain.eq.${slug},subdomain.eq.${slug}`);
        } else {
          // Otherwise, it's a regular slug
          storeQuery = storeQuery.eq("slug", slug);
        }
      } else {
        // Fallback to slug
        storeQuery = storeQuery.eq("slug", slug);
      }

      const { data: storeData, error: storeError } = await storeQuery.maybeSingle();

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
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .eq("store_id", storeData.id)
        .order("name");

      if (categoriesError) {
        console.error("Error fetching categories:", categoriesError);
      } else if (categoriesData) {
        setCategories(categoriesData);
      }

      // Fetch published products for this store
      const publishedProducts = await getPublishedProducts(storeData.id);
      setProducts(publishedProducts as any);
      
      // Featured products (first 16)
      setFeaturedProducts(publishedProducts.slice(0, 16) as any);
      
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
        {/* Hero Banner Carousel Section */}
        <HeroBannerCarousel
          bannerUrls={store.hero_banner_urls && store.hero_banner_urls.length > 0 
            ? store.hero_banner_urls 
            : store.hero_banner_url 
            ? [store.hero_banner_url] 
            : []}
          storeName={store.name}
          logoUrl={store.logo_url}
          storeDescription={store.description}
        />

        {/* Categories Section - Right after banner */}
        {categories.length > 0 && (
          <section className="py-20 bg-gradient-to-b from-muted/30 to-background relative overflow-hidden">
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
                    const productCount = products.filter(p => p.category === category.name && p.status === 'published').length;
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
                          slug={isSubdomain ? undefined : store?.slug}
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
              <Link to={productsLink}>
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
                    storeSlug={isSubdomain ? undefined : store.slug}
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
                <Link to={productsLink}>
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
                    storeSlug={isSubdomain ? undefined : store.slug}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="py-20 bg-primary text-primary-foreground mb-0">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Start Shopping?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Explore our full collection of amazing products
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to={productsLink}>
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