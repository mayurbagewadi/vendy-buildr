import { lazy, Suspense, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/new-storefront/components/StorefrontHeader";
import ProductCard from "@/components/customer/ProductCard";
import CategoryCard from "@/components/customer/CategoryCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { getPublishedProducts } from "@/lib/productData";
import { getPublicStoreCategories } from "@/lib/storefrontCategoryData";
import HeroBannerCarousel from "@/components/customer/HeroBannerCarousel";
import { useSEOStore } from "@/hooks/useSEO";
import { SEOHead } from "@/components/seo/SEOHead";
import { getStoreCanonicalUrl } from "@/lib/seo/canonicalUrl";
import { AnimateOnScroll } from "@/components/animations/AnimateOnScroll";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import WhatsAppFloat from "@/components/customer/WhatsAppFloat";
import { useStorefront } from "@/contexts/StoreContext";
import { useCart } from "@/contexts/CartContext";
import ThemeRenderBoundary from "@/new-storefront/theme-engine/ThemeRenderBoundary";
import { normalizeThemePageLayout } from "@/new-storefront/theme-engine/layout";
import { useActiveStorefrontThemeRuntime } from "@/new-storefront/theme-engine/resolveTheme";
import { buildThemeRuntimeContext } from "@/new-storefront/theme-engine/runtimeProps";
import { resolveThemeSettings } from "@/new-storefront/theme-engine/settings";
import { buildStorefrontUrls } from "@/new-storefront/theme-engine/storefrontUrls";
import type { ThemeStorefrontProps, ThemeSectionInstance } from "@/new-storefront/theme-engine/types";

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
  const store = ctxStore;
  const { cart, cartCount, cartTotal, addToCart, updateQuantity, removeItem } = useCart();
  const { runtime: activeMarketplaceTheme } = useActiveStorefrontThemeRuntime();

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [themeRenderFailed, setThemeRenderFailed] = useState(false);
  const [draftSections, setDraftSections] = useState<ThemeSectionInstance[] | null>(null);
  const [draftGlobalSettings, setDraftGlobalSettings] = useState<Record<string, unknown> | null>(null);

  // Scroll animations (unchanged)
  const categoriesGridRef       = useScrollAnimation({ animation: 'slideUp',     duration: 0.6, stagger: 0.1,  delay: 0.2 });
  const featuredProductsGridRef = useScrollAnimation({ animation: 'fadeSlideUp', duration: 0.6, stagger: 0.08, delay: 0.2 });
  const newArrivalsGridRef      = useScrollAnimation({ animation: 'fadeSlideUp', duration: 0.6, stagger: 0.08, delay: 0.2 });

  const storefrontUrls = buildStorefrontUrls({ slug });
  const isSubdomain = storefrontUrls.home === "/";

  useEffect(() => {
    setThemeRenderFailed(false);
  }, [activeMarketplaceTheme?.id, activeMarketplaceTheme?.version]);

  // Listen for AI Designer draft preview messages
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'VENDY_THEME_DRAFT') return;
      const { sections, settings } = event.data;
      if (Array.isArray(sections)) setDraftSections(sections as ThemeSectionInstance[]);
      if (settings && typeof settings === 'object') setDraftGlobalSettings(settings as Record<string, unknown>);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ── Page data: categories + products — shared storefront data layer ─────────
  // Fires immediately once ctxStore.id is available (instant on cached sessions).
  // Previously: 4 sequential DB round-trips (store→profile→categories→products)
  // Theme design comes from published theme state, not legacy live CSS injection.
  const { data: pageData, isLoading: pageLoading } = useQuery({
    queryKey: ['store-page', ctxStore?.id],
    queryFn: async () => {
      const storeId = ctxStore!.id;
      const [categoriesResult, products, categoryCountsResult] = await Promise.all([
        getPublicStoreCategories(storeId, 50),
        getPublishedProducts(storeId, 16),
        (supabase as any).rpc('get_category_product_counts', { p_store_id: storeId }),
      ]);
      return {
        categories: categoriesResult as Category[],
        products:   products as Product[],
        categoryCounts: !categoryCountsResult.error && categoryCountsResult.data
          ? new Map(
              (categoryCountsResult.data as CategoryProductCount[]).map((row) => [
                row.category,
                Number(row.product_count) || 0,
              ])
            )
          : new Map<string, number>(),
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

  // Runtime themes receive published settings/layout through theme state.
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

  // ── Marketplace theme renderer ───────────────────────────────────────────────
  const ThemeStorefront = activeMarketplaceTheme?.components.Storefront;
  const publishedThemeSettings = store.theme_state?.published_settings ?? null;
  const publishedPageLayout = store.theme_state?.published_page_layout ?? null;
  const resolvedThemeSettings = activeMarketplaceTheme
    ? resolveThemeSettings(activeMarketplaceTheme, draftGlobalSettings ?? publishedThemeSettings)
    : {};
  const publishedSections = activeMarketplaceTheme
    ? normalizeThemePageLayout(activeMarketplaceTheme, "home", publishedPageLayout).sections
    : undefined;
  const effectiveSections = draftSections ?? publishedSections;
  const themeStorefrontProps: ThemeStorefrontProps | null = activeMarketplaceTheme
    ? {
        store,
        products,
        categories,
        showInternalHeader: false,
        cart,
        cartCount,
        cartTotal,
        urls: storefrontUrls,
        actions: {
          addToCart,
          updateQuantity,
          removeItem,
        },
        runtime: buildThemeRuntimeContext(activeMarketplaceTheme),
        settings: resolvedThemeSettings,
        sections: effectiveSections,
        page: {
          page: "home",
          settings: resolvedThemeSettings,
          sections: effectiveSections,
        },
      }
    : null;

  if (ThemeStorefront && themeStorefrontProps && !themeRenderFailed) {
    return (
      <>
        <SEOHead
          title={`${store.name} - Online Store | Shop Quality Products`}
          description={store.description || `Browse ${store.name}'s collection of quality products.`}
          canonical={getStoreCanonicalUrl(store.slug, store.subdomain, store.custom_domain)}
          image={store.logo_url || store.hero_banner_url || 'https://digitaldukandar.in/logo.png'}
          keywords={categories.map(c => c.name).concat([store.name, 'online store', 'shop'])}
          type="website"
        />
        <Header storeSlug={store.slug} storeId={store.id} />
        <ThemeRenderBoundary onError={() => setThemeRenderFailed(true)}>
          <ThemeStorefront {...themeStorefrontProps} />
        </ThemeRenderBoundary>
      </>
    );
  }

  // ── Default fallback layout classes ──────────────────────────────────────────
  const gridColsClass = "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6";

  const sectionPy = "py-16";

  const showInstagramReels = store.instagram_reels_settings?.enabled && store.instagram_reels_settings?.show_on_homepage;
  const showGoogleReviews  = store.google_reviews_enabled;
  const hasMiddleSections  = showInstagramReels || showGoogleReviews;

  const sectionPyLarge = "py-20";

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
            Runtime themes should control design through schema-backed settings.
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
            Runtime themes should control design through schema-backed settings.
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
            Runtime themes should control design through schema-backed settings.
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
                <Link to={storefrontUrls.products}>
                  <Button variant="outline" className="border-primary text-primary">
                    See All
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </AnimateOnScroll>
            {featuredProducts.length > 0 ? (
              <div ref={featuredProductsGridRef} className={gridColsClass}>
                {featuredProducts.map((product, index) => (
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
                    priorityImage={index < 6}
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
            Runtime themes should control design through schema-backed settings.
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
            Runtime themes should control design through schema-backed settings.
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
            Runtime themes should control design through schema-backed settings.
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
                  <Link to={storefrontUrls.products}>
                    <Button variant="outline" className="border-primary text-primary">
                      See All
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </AnimateOnScroll>
              <div ref={newArrivalsGridRef} className={gridColsClass}>
                {newArrivals.map((product, index) => (
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
                    priorityImage={index < 3}
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
