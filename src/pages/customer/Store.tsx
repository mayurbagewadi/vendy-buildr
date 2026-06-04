import { lazy, Suspense, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/customer/Header";
import ProductCard from "@/components/customer/ProductCard";
import CategoryCard from "@/components/customer/CategoryCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { getPublishedProducts } from "@/lib/productData";
import HeroBannerCarousel from "@/components/customer/HeroBannerCarousel";
import { isStoreSpecificDomain } from "@/lib/domainUtils";
import { useSEOStore } from "@/hooks/useSEO";
import { SEOHead } from "@/components/seo/SEOHead";
import { getStoreCanonicalUrl } from "@/lib/seo/canonicalUrl";
import { AnimateOnScroll } from "@/components/animations/AnimateOnScroll";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { AIDesignResult } from "@/lib/aiDesigner";
import WhatsAppFloat from "@/components/customer/WhatsAppFloat";
import { useStorefront } from "@/contexts/StoreContext";
import { applyStoreDesignCSS } from "@/lib/applyStoreDesign";

const StoreFooter = lazy(() => import("@/components/customer/StoreFooter"));
const InstagramReels = lazy(() => import("@/components/customer/InstagramReels"));
const GoogleReviewsSection = lazy(() =>
  import("@/components/store/reviews").then((module) => ({
    default: module.GoogleReviewsSection,
  }))
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  category: string;
  price_range?: string;
  images: string[];
  status: string;
  created_at?: string;
}

/**
 * StoreData mirrors the stores DB row for type-safe field access.
 * StoreContext uses select('*') so all columns are present at runtime;
 * we cast ctxStore to this shape after receiving it.
 */
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
  instagram_reels_settings: {
    enabled: boolean;
    display_mode: string;
    max_reels: number;
    manual_reels: { url: string; thumbnail_url?: string; caption?: string }[];
    show_on_homepage: boolean;
    section_title: string;
  } | null;
  instagram_username: string | null;
  google_reviews_enabled: boolean | null;
  whatsapp_float_enabled: boolean | null;
  storefront_theme: string | null;
  storefront_template: string;
}

interface Category {
  id: string;
  name: string;
  image_url?: string | null;
  store_id: string;
}

interface CategoryProductCount {
  category: string;
  product_count: number;
}

interface StoreProps {
  slug?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Store = ({ slug: slugProp }: StoreProps = {}) => {
  const { slug: slugParam } = useParams<{ slug?: string }>();
  const slug = slugProp || slugParam;

  // ── StoreContext: store + profile served from 5-min session cache.
  // On return visits this is instant (zero DB round trip).
  const { store: ctxStore, profile, loading: storeLoading } = useStorefront();
  // Cast to StoreData — safe because StoreContext uses select('*')
  const store = ctxStore as unknown as StoreData | null;

  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Scroll animations (unchanged)
  const categoriesGridRef       = useScrollAnimation({ animation: 'slideUp',     duration: 0.6, stagger: 0.1,  delay: 0.2 });
  const featuredProductsGridRef = useScrollAnimation({ animation: 'fadeSlideUp', duration: 0.6, stagger: 0.08, delay: 0.2 });
  const newArrivalsGridRef      = useScrollAnimation({ animation: 'fadeSlideUp', duration: 0.6, stagger: 0.08, delay: 0.2 });

  const isSubdomain  = isStoreSpecificDomain();
  const productsLink = isSubdomain ? '/products' : `/${slug}/products`;

  // ── Page data: categories + products + AI design — all in parallel ──────────
  // Fires immediately once ctxStore.id is available (instant on cached sessions).
  // Previously: 4 sequential DB round-trips (store→profile→categories→products)
  // + 1 delayed AI design fetch. Now: 1 parallel batch of 3 queries.
  const { data: pageData, isLoading: pageLoading } = useQuery({
    queryKey: ['store-page', ctxStore?.id],
    queryFn: async () => {
      const storeId = ctxStore!.id;
      const [categoriesResult, products, categoryCountsResult, designResult] = await Promise.all([
        supabase.from('categories').select('*').eq('store_id', storeId).order('name'),
        getPublishedProducts(storeId, 16),
        (supabase as any).rpc('get_category_product_counts', { p_store_id: storeId }),
        supabase
          .from('store_design_state')
          .select('current_design, ai_full_css, mode')
          .eq('store_id', storeId)
          .maybeSingle(),
      ]);
      return {
        categories: (categoriesResult.data ?? []) as Category[],
        products:   products as Product[],
        categoryCounts: !categoryCountsResult.error && categoryCountsResult.data
          ? new Map(
              (categoryCountsResult.data as CategoryProductCount[]).map((row) => [
                row.category,
                Number(row.product_count) || 0,
              ])
            )
          : new Map<string, number>(),
        design:     designResult.data ?? null,
      };
    },
    enabled:   !!ctxStore?.id,
    staleTime: 5  * 60 * 1000, // 5 min — products/categories rarely change mid-session
    gcTime:    10 * 60 * 1000, // keep in memory 10 min for instant back-navigation
  });

  // Combined loading: wait for both store context AND page-specific data
  const loading = storeLoading || pageLoading;

  // Derive display data from query results (no separate state needed)
  const categories       = pageData?.categories ?? [];
  const products         = pageData?.products   ?? [];
  const categoryCounts   = pageData?.categoryCounts ?? new Map<string, number>();
  const featuredProducts = products.slice(0, 16);
  const newArrivals      = [...products]
    .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
    .slice(0, 4);

  // Derive AI design for layout calculations
  const aiDesign = (pageData?.design?.current_design as unknown as AIDesignResult | null) ?? null;

  // ── Apply AI design CSS whenever page data arrives ───────────────────────────
  useEffect(() => {
    applyStoreDesignCSS(pageData?.design ?? null);
  }, [pageData?.design]);

  // ── ElevenLabs AI Voice Widget — loaded on demand ───────────────────────────
  useEffect(() => {
    if (!store?.ai_voice_embed_code) return;

    const existing = document.querySelector('script[src*="elevenlabs"]');
    if (existing) { setScriptLoaded(true); return; }

    const script = document.createElement('script');
    script.src   = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    script.async = true;
    script.type  = 'text/javascript';
    script.onload = () => setScriptLoaded(true);
    document.body.appendChild(script);

    return () => { script.parentNode?.removeChild(script); };
  }, [store?.ai_voice_embed_code]);

  // ── SEO structured data ──────────────────────────────────────────────────────
  useSEOStore(
    store && profile
      ? {
          store: {
            id:              store.id,
            name:            store.name,
            slug:            store.slug,
            description:     store.description,
            logo_url:        store.logo_url,
            address:         store.address,
            whatsapp_number: store.whatsapp_number,
            social_links:    store.social_links,
            alternate_names: store.alternate_names,
            seo_description: store.seo_description,
            business_phone:  store.business_phone,
            business_email:  store.business_email,
            street_address:  store.street_address,
            city:            store.city,
            state:           store.state,
            postal_code:     store.postal_code,
            country:         store.country,
            opening_hours:   store.opening_hours,
            facebook_url:    store.facebook_url,
            instagram_url:   store.instagram_url,
            twitter_url:     store.twitter_url,
            price_range:     store.price_range,
          },
          email: profile.email || undefined,
          breadcrumbs: [
            { name: 'Home',     url: window.location.origin },
            { name: store.name, url: window.location.href  },
          ],
        }
      : null
  );

  // ── Loading / not-found guards ───────────────────────────────────────────────
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

  // ── Layout classes derived from AI design ────────────────────────────────────
  const gridColsClass = (() => {
    const cols = aiDesign?.layout?.product_grid_cols;
    if (cols === "2") return "grid grid-cols-2 sm:grid-cols-2 gap-6";
    if (cols === "3") return "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-6";
    return "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6";
  })();

  const sectionPy = (() => {
    const p = aiDesign?.layout?.section_padding;
    if (p === "compact")  return "py-8";
    if (p === "spacious") return "py-24";
    return "py-16";
  })();

  const showInstagramReels = store.instagram_reels_settings?.enabled && store.instagram_reels_settings?.show_on_homepage;
  const showGoogleReviews  = store.google_reviews_enabled;
  const hasMiddleSections  = showInstagramReels || showGoogleReviews;

  const sectionPyLarge = (() => {
    const p = aiDesign?.layout?.section_padding;
    if (p === "compact")  return "py-10";
    if (p === "spacious") return "py-28";
    return "py-20";
  })();

  // ── Render ───────────────────────────────────────────────────────────────────
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
        {/* ═══ HERO BANNER SECTION ═══
            Purpose: Large banner at top of page with store name and logo
            Content: Carousel of banner images, store description, CTA buttons
            AI Can Change: Background colors, text colors, spacing, gradients, shadows, button styles
            Selectors: [data-ai="section-hero"] - affects entire hero section
        */}
        <section data-ai="section-hero">
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
        </section>

        {/* ═══ CATEGORIES SECTION ═══
            Purpose: Horizontal scrollable list of product categories
            Content: Category name, image, product count for each category
            AI Can Change: Background colors, gradients, section padding, card spacing, border radius, shadows, text colors, heading styles
            Selectors: [data-ai="section-categories"] - entire section | [data-ai="category-card"] - individual cards
        */}
        {categories.length > 0 && (
          <section data-ai="section-categories" className={`${sectionPyLarge} bg-gradient-to-b from-muted/30 to-background relative overflow-hidden`}>
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
                    const productCount = categoryCounts.get(category.name) || 0;
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

        {/* ═══ FEATURED PRODUCTS SECTION ═══
            Purpose: Grid display of top/featured products
            Content: Product cards with image, name, price range, "See All" button
            AI Can Change: Grid layout (columns), card backgrounds, shadows, border radius, product spacing, heading styles, button colors
            Selectors: [data-ai="section-featured"] - entire section | [data-ai="product-card"] - individual product cards
        */}
        <section data-ai="section-featured" className={`py-16 ${hasMiddleSections ? 'pb-16' : 'pb-4'} bg-background`}>
          <div className="container mx-auto px-4">
            <AnimateOnScroll animation="fadeSlideUp" duration={0.7}>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-foreground mb-2">Featured Products</h2>
                  <p className="text-muted-foreground">Check out our top picks for you</p>
                </div>
                <Link to={productsLink}>
                  <Button variant="outline" className="border-primary text-primary">
                    See All
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </AnimateOnScroll>
            {featuredProducts.length > 0 ? (
              <div ref={featuredProductsGridRef} className={gridColsClass}>
                {featuredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    slug={(product as any).slug}
                    name={product.name}
                    category={product.category}
                    priceRange={product.price_range || ''}
                    basePrice={(product as any).base_price}
                    offerPrice={(product as any).offer_price}
                    variants={(product as any).variants}
                    stock={(product as any).stock}
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

        {/* ═══ INSTAGRAM REELS SECTION ═══
            Purpose: Display Instagram reels/videos in a grid or carousel
            Content: Video thumbnails, play buttons, captions
            AI Can Change: Section background, grid spacing, thumbnail borders, shadows, spacing, heading colors
            Selectors: [data-ai="section-reels"] - entire reels section
        */}
        {store.instagram_reels_settings?.enabled && store.instagram_reels_settings?.show_on_homepage && (
          <section data-ai="section-reels">
            <Suspense fallback={null}>
              <InstagramReels
                storeId={store.id}
                settings={store.instagram_reels_settings}
                instagramUsername={store.instagram_username || undefined}
              />
            </Suspense>
          </section>
        )}

        {/* ═══ GOOGLE REVIEWS SECTION ═══
            Purpose: Display customer reviews from Google with ratings
            Content: Review text, star ratings, reviewer names, profile pictures
            AI Can Change: Background colors, review card styles, spacing, border radius, text colors, heading styles, shadows
            Selectors: [data-ai="section-reviews"] - entire reviews section
        */}
        {store.google_reviews_enabled && (
          <section data-ai="section-reviews" className={`${sectionPy} bg-muted/30`}>
            <div className="container mx-auto px-4">
              <Suspense fallback={null}>
                <GoogleReviewsSection
                  storeId={store.id}
                  autoPlay={true}
                />
              </Suspense>
            </div>
          </section>
        )}

        {/* ═══ NEW ARRIVALS SECTION ═══
            Purpose: Showcase recently added/new products
            Content: Product grid with new products, images, names, prices, "See All" button
            AI Can Change: Grid columns, card backgrounds, shadows, spacing, border radius, heading styles, button colors
            Selectors: [data-ai="section-new-arrivals"] - entire section | [data-ai="product-card"] - individual product cards
        */}
        {newArrivals.length > 0 && (
          <section data-ai="section-new-arrivals" className={`${hasMiddleSections ? sectionPy : 'py-16 pt-4'}`}>
            <div className="container mx-auto px-4">
              <AnimateOnScroll animation="fadeSlideUp" duration={0.7}>
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-foreground mb-2">
                      New Arrivals
                    </h2>
                    <p className="text-muted-foreground">Fresh products just for you</p>
                  </div>
                  <Link to={productsLink}>
                    <Button variant="outline" className="border-primary text-primary">
                      See All
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </AnimateOnScroll>
              <div ref={newArrivalsGridRef} className={gridColsClass}>
                {newArrivals.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    slug={(product as any).slug}
                    name={product.name}
                    category={product.category}
                    priceRange={product.price_range || ''}
                    basePrice={(product as any).base_price}
                    offerPrice={(product as any).offer_price}
                    variants={(product as any).variants}
                    stock={(product as any).stock}
                    images={product.images}
                    status={product.status}
                    storeSlug={isSubdomain ? undefined : store.slug}
                  />
                ))}
              </div>
            </div>
          </section>
        )}


      </main>

      <Suspense fallback={null}>
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
      </Suspense>

      {/* WhatsApp Float Button */}
      {store.whatsapp_float_enabled !== false && store.whatsapp_number && (
        <WhatsAppFloat storeId={store.id} />
      )}

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
