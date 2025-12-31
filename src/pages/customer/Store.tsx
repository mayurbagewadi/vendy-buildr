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
import { useSEOStore } from "@/hooks/useSEO";
import { SEOHead } from "@/components/seo/SEOHead";
import { getStoreCanonicalUrl } from "@/lib/seo/canonicalUrl";
import { AnimateOnScroll } from "@/components/animations/AnimateOnScroll";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

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
  subdomain: string | null;
  custom_domain: string | null;
  description: string | null;
  logo_url: string | null;
  hero_banner_url: string | null;
  hero_banner_urls: string[] | null;
  whatsapp_number: string | null;
  address: string | null;
  ai_voice_embed_code: string | null;
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
  // SEO fields
  alternate_names: string | null;
  seo_description: string | null;
  business_phone: string | null;
  business_email: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  opening_hours: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  youtube_url: string | null;
  linkedin_url: string | null;
  price_range: string | null;
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
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Scroll animations
  const categoriesGridRef = useScrollAnimation({ animation: 'slideUp', duration: 0.6, stagger: 0.1, delay: 0.2 });
  const featuredProductsGridRef = useScrollAnimation({ animation: 'fadeSlideUp', duration: 0.6, stagger: 0.08, delay: 0.2 });
  const newArrivalsGridRef = useScrollAnimation({ animation: 'fadeSlideUp', duration: 0.6, stagger: 0.08, delay: 0.2 });

  // Determine if we're on a store-specific domain (subdomain or custom domain)
  const isSubdomain = isStoreSpecificDomain();
  // Build links based on domain type
  const productsLink = isSubdomain ? '/products' : `/${slug}/products`;

  useEffect(() => {
    loadStoreData();
  }, [slug]);

  // Load ElevenLabs script dynamically
  useEffect(() => {
    if (!store?.ai_voice_embed_code) return;

    // Check if script is already loaded
    const existingScript = document.querySelector('script[src*="elevenlabs"]');
    if (existingScript) {
      setScriptLoaded(true);
      return;
    }

    // Create and load the script
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    script.async = true;
    script.type = 'text/javascript';

    script.onload = () => {
      console.log('ElevenLabs widget script loaded successfully');
      setScriptLoaded(true);
    };

    script.onerror = (error) => {
      console.error('Failed to load ElevenLabs widget script:', error);
    };

    document.body.appendChild(script);

    // Cleanup on unmount
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [store?.ai_voice_embed_code]);

  // SEO: Add structured data for store page (Organization Schema + Breadcrumbs)
  useSEOStore(
    store && profile
      ? {
          store: {
            id: store.id,
            name: store.name,
            slug: store.slug,
            description: store.description,
            logo_url: store.logo_url,
            address: store.address,
            whatsapp_number: store.whatsapp_number,
            social_links: store.social_links,
            // SEO fields from admin settings
            alternate_names: store.alternate_names,
            seo_description: store.seo_description,
            business_phone: store.business_phone,
            business_email: store.business_email,
            street_address: store.street_address,
            city: store.city,
            state: store.state,
            postal_code: store.postal_code,
            country: store.country,
            opening_hours: store.opening_hours,
            facebook_url: store.facebook_url,
            instagram_url: store.instagram_url,
            twitter_url: store.twitter_url,
            price_range: store.price_range
          },
          email: profile.email || undefined,
          breadcrumbs: [
            {
              name: 'Home',
              url: window.location.origin
            },
            {
              name: store.name,
              url: window.location.href
            }
          ]
        }
      : null
  );

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
          // FIX: When on store-specific domain, query by subdomain OR slug to handle mismatches
          // This handles cases where subdomain field differs from slug (e.g., subdomain="test" but slug="store")
          storeQuery = storeQuery.or(`subdomain.eq.${slug},slug.eq.${slug}`);
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
      <SEOHead
        title={`${store.name} - Online Store | Shop Quality Products`}
        description={store.description || `Browse ${store.name}'s collection of quality products. ${categories.length > 0 ? 'Explore categories: ' + categories.map(c => c.name).slice(0, 3).join(', ') : ''}`}
        canonical={getStoreCanonicalUrl(store.slug, store.subdomain, store.custom_domain)}
        image={store.logo_url || store.hero_banner_url || 'https://digitaldukandar.in/logo.png'}
        keywords={categories.map(c => c.name).concat([store.name, 'online store', 'shop'])}
        type="website"
      />
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
              <AnimateOnScroll animation="fadeSlideUp" duration={0.8}>
                <div className="text-center mb-12">
                  <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                    Shop by Category
                  </h2>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Explore our curated collections designed just for you
                  </p>
                </div>
              </AnimateOnScroll>
              
              {/* Horizontal Scrollable Layout */}
              <div className="relative px-4">
                <div ref={categoriesGridRef} className="flex gap-2 overflow-x-auto py-4 scrollbar-hide snap-x snap-mandatory px-4">
                  {categories.map((category, index) => {
                    const productCount = products.filter(p => p.category === category.name && p.status === 'published').length;
                    return (
                      <div
                        key={category.id}
                        className="flex-shrink-0 w-48 snap-center"
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
            <AnimateOnScroll animation="fadeSlideUp" duration={0.7}>
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
            </AnimateOnScroll>
            {featuredProducts.length > 0 ? (
              <div ref={featuredProductsGridRef} className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {featuredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    slug={(product as any).slug}
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
              <AnimateOnScroll animation="fadeSlideUp" duration={0.7}>
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
              </AnimateOnScroll>
              <div ref={newArrivalsGridRef} className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {newArrivals.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    slug={(product as any).slug}
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
            <AnimateOnScroll animation="scale" duration={0.8}>
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
            </AnimateOnScroll>
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
        // Dedicated social URL fields (Growth → Social Media) - PRIORITY
        facebookUrl={store.facebook_url}
        instagramUrl={store.instagram_url}
        twitterUrl={store.twitter_url}
        youtubeUrl={store.youtube_url}
        linkedinUrl={store.linkedin_url}
        // Legacy (Settings) - FALLBACK
        socialLinks={store.social_links}
        policies={store.policies}
      />

      {/* AI Voice Assistant Widget - Rendered after script loads */}
      {store.ai_voice_embed_code && scriptLoaded && (() => {
        // Extract agent-id from embed code
        const agentIdMatch = store.ai_voice_embed_code.match(/agent-id="([^"]+)"/);
        const agentId = agentIdMatch ? agentIdMatch[1] : null;

        if (!agentId) {
          console.error('No agent-id found in ai_voice_embed_code');
          return null;
        }

        return (
          <elevenlabs-convai
            agent-id={agentId}
            style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999 }}
          />
        );
      })()}
    </div>
  );
};

export default Store;