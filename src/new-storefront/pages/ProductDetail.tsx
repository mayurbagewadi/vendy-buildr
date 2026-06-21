import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Header from "@/new-storefront/components/StorefrontHeader";
import StoreFooter from "@/components/customer/StoreFooter";
import { useStorefront } from "@/contexts/StoreContext";
import { applyStoreDesignCSS } from "@/lib/applyStoreDesign";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, ShoppingCart, Share2, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import { generateProductImageAlt } from "@/lib/seo/altTags";
import LazyImage from "@/components/ui/lazy-image";

import { getProductById, getProductBySlug, getPublishedProducts } from "@/lib/productData";
import { LoadingSpinner } from "@/components/customer/LoadingSpinner";
import ProductCard from "@/components/customer/ProductCard";
import { isStoreSpecificDomain } from "@/lib/domainUtils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useSEOProduct } from "@/hooks/useSEO";
import { SEOHead } from "@/components/seo/SEOHead";
import { getProductCanonicalUrl } from "@/lib/seo/canonicalUrl";
import { useActiveStorefrontThemeRuntime } from "@/new-storefront/theme-engine/resolveTheme";

interface Variant {
  name: string;
  price: number;
  sku?: string;
  offer_price?: number;
  stock?: number | string | null;
}

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  images: string[];
  videoUrl?: string;
  video_url?: string;
  basePrice?: number;
  base_price?: number;
  offerPrice?: number;
  offer_price?: number;
  baseSku?: string;
  sku?: string;
  variants?: Variant[];
  priceRange?: string;
  price_range?: string;
  stock?: number | string | null;
  status: string;
  storeId?: string;
  store_id?: string;
}

interface ProductDetailProps {
  slug?: string;
}

const isZeroStock = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return false;
  const parsedStock = Number(value);
  return Number.isFinite(parsedStock) && parsedStock === 0;
};

const isProductAvailableForSeo = (product: Product) => {
  if (product.status !== "published") return false;
  const variants = product.variants || [];
  if (variants.length > 0) {
    return variants.some((variant) => !isZeroStock(variant.stock));
  }
  return !isZeroStock(product.stock);
};

const COLLAPSED_DESCRIPTION_HEIGHT = 96;
const COLLAPSED_DESCRIPTION_CHARACTER_LIMIT = 280;

const ProductDetail = ({ slug: slugProp }: ProductDetailProps = {}) => {
  // Handle both route patterns:
  // 1. SUBDOMAIN: /products/:slug (with slugProp from App.tsx containing storeIdentifier)
  //    - params.slug = product slug
  //    - slugProp = store identifier
  // 2. PATH-BASED: /:slug/products/:productSlug (on main platform)
  //    - params.slug = store slug
  //    - params.productSlug = product slug
  const params = useParams();

  // Determine product slug based on route pattern
  // If slugProp is provided (subdomain route), params.slug is the product slug
  // Otherwise (path-based route), params.productSlug is the product slug
  const productSlug = slugProp ? params.slug : params.productSlug;
  const storeSlugFromRoute = slugProp ? slugProp : params.slug; // Store slug from path or prop

  const navigate = useNavigate();
  const { toast } = useToast();
  const { addToCart, triggerFlyAnimation } = useCart();
  const { runtime: activeTheme } = useActiveStorefrontThemeRuntime();

  // ── StoreContext: store + profile already resolved — no separate fetch needed
  const { store: ctxStore, profile: ctxProfile, loading: storeLoading } = useStorefront();
  const storeData    = ctxStore as any;   // all columns present (select('*'))
  const profileData  = ctxProfile as any;
  // storeId and storeSlug derived from context; fall back to route prop during load
  const storeId   = ctxStore?.id   ?? null;
  const storeSlug = ctxStore?.slug ?? storeSlugFromRoute;

  const [product, setProduct] = useState<Product | null>(null);
  const mainImageRef = useRef<HTMLImageElement>(null);
  const variantSectionRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [productLoading, setProductLoading] = useState(true);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isDescriptionOverflowing, setIsDescriptionOverflowing] = useState(false);

  // Combined loading: wait for context + product data
  const loading = storeLoading || productLoading;
  const shouldLimitDescriptionByLength =
    (product?.description?.length ?? 0) > COLLAPSED_DESCRIPTION_CHARACTER_LIMIT;
  const shouldShowDescriptionToggle = shouldLimitDescriptionByLength || isDescriptionOverflowing;
  const shouldCollapseDescription = shouldShowDescriptionToggle && !isDescriptionExpanded;

  // Determine if we're on a store-specific domain (subdomain or custom domain)
  const isSubdomain = isStoreSpecificDomain();
  const isSeoAvailable = product ? isProductAvailableForSeo(product) : false;
  const ThemeProductDetail = activeTheme?.components.ProductDetail;

  useEffect(() => {
    // Wait for StoreContext to resolve before fetching the product.
    // storeLoading ensures we don't fire before ctxStore is available.
    if (!productSlug || storeLoading) return;

    const loadProduct = async () => {
      try {
        setProductLoading(true);

        // Inject AI design CSS early (skip if already applied from prev page)
        const aiDesignPromise = !document.getElementById('ai-layer2-styles') && storeId
          ? supabase
              .from('store_design_state')
              .select('current_design, ai_full_css, mode')
              .eq('store_id', storeId)
              .maybeSingle()
          : Promise.resolve({ data: null });

        // Fetch product + AI design in parallel (store/profile come from context)
        const [productData, designResult] = await Promise.all([
          getProductBySlug(productSlug, storeId || undefined),
          aiDesignPromise,
        ]);

        // Apply AI design CSS if not already injected
        if (designResult.data) {
          applyStoreDesignCSS(designResult.data);
        }

        // Fallback: try by UUID for backward compatibility
        let data = productData;
        if (!data) {
          data = await getProductById(productSlug);
          // Found by UUID → redirect to slug URL (SEO 301)
          if (data && data.slug) {
            const newUrl = isSubdomain
              ? `/products/${data.slug}`
              : storeSlug
                ? `/${storeSlug}/products/${data.slug}`
                : `/products/${data.slug}`;
            navigate(newUrl, { replace: true });
            return;
          }
        }

        if (!data) {
          toast({
            title: "Product not found",
            description: "This product doesn't exist or has been removed.",
            variant: "destructive",
          });
          navigate("/products");
          return;
        }

        setProduct(data);

        // Auto-select when only one variant exists
        if (data.variants && data.variants.length === 1) {
          setSelectedVariant(data.variants[0].name);
        }

        // Fetch related products — limit to 12 (was 200, wasted bandwidth)
        if (storeId) {
          const allStoreProducts = await getPublishedProducts(storeId, 12);
          const others   = allStoreProducts.filter(p => p.id !== data!.id);
          const sameCat  = others.filter(p => p.category === data!.category);
          setRelatedProducts(sameCat.length > 0 ? sameCat : others);
        }

      } catch (error) {
        console.error("Error loading product:", error);
        toast({
          title: "Error",
          description: "Failed to load product details",
          variant: "destructive",
        });
        navigate("/products");
      } finally {
        setProductLoading(false);
      }
    };

    loadProduct();
  }, [productSlug, storeId, storeLoading, navigate, toast, isSubdomain]);

  // Remove pulse animation when variant is selected
  useEffect(() => {
    if (selectedVariant && variantSectionRef.current) {
      variantSectionRef.current.classList.remove('animate-pulse');
    }
  }, [selectedVariant]);

  useEffect(() => {
    setIsDescriptionExpanded(false);
  }, [product?.id]);

  useEffect(() => {
    const descriptionElement = descriptionRef.current;
    if (!descriptionElement) return;

    const updateOverflowState = () => {
      setIsDescriptionOverflowing(
        descriptionElement.scrollHeight > COLLAPSED_DESCRIPTION_HEIGHT + 1
      );
    };

    updateOverflowState();

    const animationFrameId = window.requestAnimationFrame(updateOverflowState);
    const timeoutId = window.setTimeout(updateOverflowState, 100);

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(updateOverflowState)
      : null;

    resizeObserver?.observe(descriptionElement);
    window.addEventListener("resize", updateOverflowState);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(timeoutId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateOverflowState);
    };
  }, [product?.description]);

  // SEO: Add structured data for product page (Product Schema + Organization Schema + Breadcrumbs)
  useSEOProduct(
    product && storeData
      ? {
          product: {
            id: product.id,
            name: product.name,
            description: product.description,
            images: product.images,
            base_price: product.base_price || product.basePrice,
            price_range: product.price_range || product.priceRange,
            sku: product.sku || product.baseSku,
            category: product.category,
            variants: product.variants,
            status: product.status
          },
          store: {
            id: storeData.id,
            name: storeData.name,
            slug: storeData.slug,
            description: storeData.description,
            logo_url: storeData.logo_url,
            address: storeData.address,
            whatsapp_number: storeData.whatsapp_number,
            social_links: storeData.social_links
          },
          availability: isSeoAvailable ? 'InStock' : 'OutOfStock',
          email: profileData?.email,
          breadcrumbs: [
            {
              name: 'Home',
              url: isSubdomain
                ? window.location.origin
                : `${window.location.origin}/${storeSlug}`
            },
            {
              name: 'Products',
              url: isSubdomain
                ? `${window.location.origin}/products`
                : `${window.location.origin}/${storeSlug}/products`
            },
            {
              name: product.name,
              url: window.location.href
            }
          ]
        }
      : null
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header storeSlug={storeSlug} storeId={product?.store_id || product?.storeId} />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading product..." />
        </div>
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
  }


  if (!product) {
    return null;
  }

  const currentVariant = product.variants?.find(v => v.name === selectedVariant);

  // If product has variants but none selected, don't show price
  const hasVariants = product.variants && product.variants.length > 0;
  const needsVariantSelection = hasVariants && !selectedVariant;

  const currentPrice = currentVariant
    ? (currentVariant.offer_price && currentVariant.offer_price > 0 && currentVariant.offer_price < currentVariant.price ? currentVariant.offer_price : currentVariant.price)
    : (product.offerPrice && product.offerPrice > 0 && product.offerPrice < (product.basePrice || product.base_price || 0)
        ? product.offerPrice
        : (product.offer_price && product.offer_price > 0 && product.offer_price < (product.basePrice || product.base_price || 0)
            ? product.offer_price
            : (product.basePrice || product.base_price || 0)));

  const images = product.images && product.images.length > 0 ? product.images : ["/placeholder.svg"];
  const videoUrl = product.videoUrl || product.video_url;
  const baseSku = product.baseSku || product.sku;
  const variantStock = currentVariant && typeof currentVariant.stock === "number" ? currentVariant.stock : null;
  const availableStock = hasVariants ? variantStock : (typeof product.stock === "number" ? product.stock : null);
  const isOutOfStock = availableStock === 0;
  const stockLabel = isOutOfStock
    ? "Out of Stock"
    : availableStock !== null && availableStock <= 5
      ? `Only ${availableStock} left`
      : "In Stock";

  // Extract YouTube video ID and get thumbnail
  const getYouTubeVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    return match?.[1] || null;
  };

  const videoId = videoUrl ? getYouTubeVideoId(videoUrl) : null;
  const videoThumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  
  // Use store-specific routes if storeSlug is available
  const homeLink = isSubdomain ? "/" : (storeSlug ? `/${storeSlug}` : "/home");
  const productsLink = isSubdomain ? "/products" : (storeSlug ? `/${storeSlug}/products` : "/products");
  const cartLink = isSubdomain ? "/cart" : (storeSlug ? `/${storeSlug}/cart` : "/cart");

  if (import.meta.env.DEV || localStorage.getItem("dd_theme_debug") === "1") {
    console.info("[STOREFRONT_THEME_DEBUG][product-detail]", {
      productSlug,
      productName: product.name,
      storeId,
      storeSlug,
      storefront_template: storeData?.storefront_template,
      themeProductDetail: Boolean(ThemeProductDetail),
      htmlTheme: document.documentElement.getAttribute("data-storefront-theme"),
      htmlTemplate: document.documentElement.getAttribute("data-storefront-template"),
    });
  }

  const handleQuantityChange = (delta: number) => {
    if (isOutOfStock) return;
    const nextQuantity = Math.max(1, quantity + delta);
    setQuantity(availableStock !== null ? Math.min(nextQuantity, availableStock) : nextQuantity);
  };

  const handleAddToCart = () => {
    if (!product) return;

    if (isOutOfStock) {
      toast({
        title: "Out of stock",
        description: "This product is currently unavailable.",
        variant: "destructive",
      });
      return;
    }

    if (availableStock !== null && quantity > availableStock) {
      toast({
        title: "Stock limit reached",
        description: `Only ${availableStock} available for this ${hasVariants ? "variant" : "product"}.`,
        variant: "destructive",
      });
      setQuantity(availableStock);
      return;
    }

    // Validate variant selection if product has variants
    if (product.variants && product.variants.length > 0 && !selectedVariant) {
      toast({
        title: "Please select a variant",
        description: "Redirecting to variant section...",
        variant: "destructive",
      });

      // After 1 second, scroll to variant section and keep pulsing
      setTimeout(() => {
        if (variantSectionRef.current) {
          variantSectionRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
          // Add a pulse animation - will stay until variant is selected
          variantSectionRef.current.classList.add('animate-pulse');
        }
      }, 1000);

      return;
    }

    const storeId = product.store_id;

    if (!storeId) {
      toast({
        title: "Error",
        description: "Unable to add product to cart. Store information is missing.",
        variant: "destructive",
      });
      return;
    }

    // Trigger fly animation
    if (mainImageRef.current) {
      triggerFlyAnimation(images[0], mainImageRef.current);
    }

    addToCart({
      productId: product.id,
      productName: product.name,
      productImage: images[0],
      variant: selectedVariant || undefined,
      price: currentPrice,
      quantity: quantity,
      sku: currentVariant?.sku || baseSku,
      storeId: storeId,
    });

    // Show confirmation modal
    setShowConfirmationModal(true);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Check out ${product.name} on MyStore`,
        url: window.location.href,
      });
    } else {
      toast({
        title: "Link copied",
        description: "Product link has been copied to clipboard",
      });
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (ThemeProductDetail) {
    return (
      <>
        <Header storeSlug={storeSlug} storeId={product.store_id || product.storeId} />
        <ThemeProductDetail
          store={ctxStore}
          profile={ctxProfile}
          storeSlug={storeSlug}
          isSubdomain={isSubdomain}
          product={product}
          relatedProducts={relatedProducts}
          currentVariant={currentVariant}
          selectedVariant={selectedVariant}
          setSelectedVariant={setSelectedVariant}
          quantity={quantity}
          selectedImage={selectedImage}
          setSelectedImage={setSelectedImage}
          showConfirmationModal={showConfirmationModal}
          setShowConfirmationModal={setShowConfirmationModal}
          isDescriptionExpanded={isDescriptionExpanded}
          setIsDescriptionExpanded={setIsDescriptionExpanded}
          images={images}
          videoUrl={videoUrl}
          videoThumbnail={videoThumbnail}
          baseSku={baseSku}
          hasVariants={Boolean(hasVariants)}
          needsVariantSelection={Boolean(needsVariantSelection)}
          currentPrice={currentPrice}
          availableStock={availableStock}
          isOutOfStock={isOutOfStock}
          stockLabel={stockLabel}
          isSeoAvailable={isSeoAvailable}
          shouldCollapseDescription={shouldCollapseDescription}
          shouldShowDescriptionToggle={shouldShowDescriptionToggle}
          mainImageRef={mainImageRef}
          variantSectionRef={variantSectionRef}
          descriptionRef={descriptionRef}
          links={{
            home: homeLink,
            products: productsLink,
            cart: cartLink,
          }}
          handleQuantityChange={handleQuantityChange}
          handleAddToCart={handleAddToCart}
          handleShare={handleShare}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title={`${product.name} - ${storeData?.name || 'Store'} | Buy Online`}
        description={product.description?.slice(0, 160) || `Shop ${product.name} from ${storeData?.name}. ${currentVariant ? `Price: ₹${currentVariant.price}` : product.base_price ? `Starting from ₹${product.base_price}` : ''}`}
        canonical={getProductCanonicalUrl(
          storeSlug || '',
          product.id,
          storeData?.subdomain,
          storeData?.custom_domain
        )}
        image={images[0]}
        type="product"
        price={currentVariant?.price || product.base_price}
        availability={isSeoAvailable ? 'in stock' : 'out of stock'}
        keywords={[product.name, product.category, storeData?.name || 'store', 'buy online']}
      />
      <Header storeSlug={storeSlug} storeId={product.store_id || product.storeId} />

      <main className="flex-1 container mx-auto px-4 py-8 pb-32 md:pb-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to={homeLink} className="hover:text-foreground">Home</Link>
          <ChevronRight className="w-4 h-4" />
          <Link to={productsLink} className="hover:text-foreground">Products</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery with Swipe Support */}
          <div data-ai="product-gallery">
            {/* Mobile: Swipeable Carousel */}
            <div className="lg:hidden mb-4">
              <Carousel className="w-full" opts={{ loop: true }}>
                <CarouselContent>
                  {images.map((image, index) => (
                    <CarouselItem key={index}>
                      <Card className="overflow-hidden">
                        <CardContent className="p-0">
                          <div className="aspect-square bg-muted">
                            <LazyImage
                              src={image}
                              alt={generateProductImageAlt({
                                productName: product.name,
                                category: product.category,
                                imageIndex: index
                              })}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </CarouselItem>
                  ))}
                  {/* Video Slide */}
                  {videoUrl && (
                    <CarouselItem key="video">
                      <Card className="overflow-hidden">
                        <CardContent className="p-0">
                          <div className="aspect-square bg-muted flex items-center justify-center p-4">
                            <div className="relative w-full h-full">
                              <iframe
                                className="absolute inset-0 w-full h-full rounded-lg"
                                src={`https://www.youtube.com/embed/${videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1] || videoUrl}`}
                                title="Product Video"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </CarouselItem>
                  )}
                </CarouselContent>
                {(images.length > 1 || videoUrl) && (
                  <>
                    <CarouselPrevious className="left-2" />
                    <CarouselNext className="right-2" />
                  </>
                )}
              </Carousel>
              {(images.length > 1 || videoUrl) && (
                <div className="flex justify-center gap-2 mt-3">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        selectedImage === index ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                      aria-label={`View image ${index + 1}`}
                    />
                  ))}
                  {videoUrl && (
                    <button
                      key="video-dot"
                      onClick={() => setSelectedImage(images.length)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        selectedImage === images.length ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                      aria-label="View video"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Desktop: Thumbnail Gallery */}
            <div className="hidden lg:block">
              <Card className="overflow-hidden mb-4">
                <CardContent className="p-0">
                  <div ref={mainImageRef} className="aspect-square bg-muted">
                    {selectedImage < images.length ? (
                      <LazyImage
                        src={images[selectedImage]}
                        alt={generateProductImageAlt({
                          productName: product.name,
                          category: product.category,
                          imageIndex: selectedImage
                        })}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      /* Video View */
                      <div className="w-full h-full flex items-center justify-center p-4">
                        <div className="relative w-full h-full">
                          <iframe
                            className="absolute inset-0 w-full h-full rounded-lg"
                            src={`https://www.youtube.com/embed/${videoUrl?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1] || videoUrl}`}
                            title="Product Video"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              {(images.length > 1 || videoUrl) && (
                <div className="grid grid-cols-5 gap-2">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors min-h-[44px] ${
                        selectedImage === index
                          ? "border-primary"
                          : "border-transparent hover:border-border"
                      }`}
                    >
                      <LazyImage
                        src={image}
                        alt={generateProductImageAlt({
                          productName: product.name,
                          category: product.category,
                          imageIndex: index
                        })}
                        className="w-full h-full object-contain"
                      />
                    </button>
                  ))}
                  {/* Video Thumbnail */}
                  {videoUrl && videoThumbnail && (
                    <button
                      key="video-thumb"
                      onClick={() => setSelectedImage(images.length)}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors min-h-[44px] relative ${
                        selectedImage === images.length
                          ? "border-primary"
                          : "border-transparent hover:border-border"
                      }`}
                    >
                <img
                  src={videoThumbnail}
                  alt={`${product.name} - Product video`}
                  className="w-full h-full object-cover"
                />
                      {/* Play icon overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Product Info */}
          <div data-ai="product-info">
            <div className="mb-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge data-ai="category-badge" variant="secondary">{product.category}</Badge>
                {isOutOfStock && <Badge variant="destructive">Out of Stock</Badge>}
              </div>
              <h1 data-ai="product-name" className="text-3xl font-bold text-foreground mb-2">{product.name}</h1>
              <div className="relative">
                <p
                  ref={descriptionRef}
                  id="product-description-text"
                  data-ai="product-description"
                  className={`text-muted-foreground whitespace-pre-wrap break-words ${
                    shouldCollapseDescription
                      ? "max-h-24 overflow-hidden"
                      : ""
                  }`}
                >
                  {product.description}
                </p>
                {shouldCollapseDescription && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent"
                  />
                )}
              </div>
              {shouldShowDescriptionToggle && (
                <button
                  type="button"
                  aria-controls="product-description-text"
                  aria-expanded={isDescriptionExpanded}
                  onClick={() => setIsDescriptionExpanded((expanded) => !expanded)}
                  className="mt-2 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {isDescriptionExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>

            {/* Variant Selection */}
            {product.variants && product.variants.length > 0 ? (
              <Card data-ai="variant-selector" ref={variantSectionRef} className={`mb-6 ${!selectedVariant ? 'ring-2 ring-primary/50 ring-offset-2' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-base font-semibold">
                      Select Variant {!selectedVariant && <span className="text-destructive">*</span>}
                    </Label>
                    {!selectedVariant && (
                      <Badge variant="destructive" className="text-xs">Required</Badge>
                    )}
                  </div>
                  <RadioGroup value={selectedVariant} onValueChange={setSelectedVariant}>
                    <div className="space-y-3">
                      {product.variants.map((variant) => {
                        const variantOutOfStock = variant.stock === 0;
                        return (
                        <div
                          key={variant.name}
                          className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all ${
                            variantOutOfStock
                              ? 'cursor-not-allowed border-border bg-muted/50 opacity-60'
                              : selectedVariant === variant.name
                                ? 'cursor-pointer border-primary bg-primary/5'
                                : 'cursor-pointer border-border hover:border-primary/50 hover:bg-accent'
                          }`}
                          onClick={() => {
                            if (!variantOutOfStock) setSelectedVariant(variant.name);
                          }}
                        >
                          <RadioGroupItem value={variant.name} id={variant.name} disabled={variantOutOfStock} className="min-w-[20px] min-h-[20px]" />
                          <Label
                            htmlFor={variant.name}
                            className={`flex-1 font-normal ${variantOutOfStock ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">
                                {variant.name}
                                {variantOutOfStock && <span className="ml-2 text-xs text-destructive">Out of stock</span>}
                              </span>
                              <div className="flex items-center gap-2">
                                {variant.offer_price && variant.offer_price > 0 && variant.offer_price < variant.price ? (
                                  <>
                                    <span className="font-bold text-primary text-lg">₹{variant.offer_price}</span>
                                    <span className="text-sm text-muted-foreground line-through">₹{variant.price}</span>
                                    <span className="bg-badge text-badge-foreground text-xs font-bold px-1.5 py-0.5 rounded">
                                      {Math.round((variant.price - variant.offer_price) / variant.price * 100)}% off
                                    </span>
                                  </>
                                ) : (
                                  <span className="font-bold text-primary text-lg">₹{variant.price}</span>
                                )}
                              </div>
                            </div>
                          </Label>
                        </div>
                      )})}
                    </div>
                  </RadioGroup>

                  {selectedVariant ? (
                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-sm font-semibold text-green-800 dark:text-green-200 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        Selected: {selectedVariant} - ₹{currentPrice}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                        </svg>
                        Please select a variant to continue
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="mb-6">
                {(() => {
                  const sp = product.basePrice || product.base_price || 0;
                  const op = product.offerPrice || product.offer_price;
                  const hasOffer = op && op > 0 && op < sp;
                  if (hasOffer) {
                    return (
                      <div className="flex items-center gap-3">
                        <p data-ai="product-price" className="text-3xl font-bold text-primary">₹{op}</p>
                        <p className="text-xl text-muted-foreground line-through">₹{sp}</p>
                        <span className="bg-badge text-badge-foreground text-sm font-bold px-2 py-1 rounded-md">
                          {Math.round((sp - op!) / sp * 100)}% off
                        </span>
                      </div>
                    );
                  }
                  if (sp > 0) {
                    return (
                      <p data-ai="product-price" className="text-3xl font-bold text-primary">₹{sp}</p>
                    );
                  }
                  if (product.price_range || product.priceRange) {
                    return (
                      <p data-ai="product-price" className="text-3xl font-bold text-primary">
                        {product.price_range || product.priceRange}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            {/* Quantity Selector - Touch Optimized */}
            <div data-ai="quantity-selector" className="mb-6">
              <Label className="text-base font-semibold mb-3 block">Quantity</Label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center border border-border rounded-lg">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="min-w-[44px] min-h-[44px]"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1 || needsVariantSelection || isOutOfStock}
                  >
                    <Minus className="w-5 h-5" />
                  </Button>
                  <span className="w-16 text-center font-semibold text-lg">
                    {quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="min-w-[44px] min-h-[44px]"
                    onClick={() => handleQuantityChange(1)}
                    disabled={needsVariantSelection || isOutOfStock || (availableStock !== null && quantity >= availableStock)}
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  Total: <span className="text-lg font-bold text-foreground">
                    {needsVariantSelection ? "—" : `₹${(currentPrice * quantity).toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons - Desktop Only */}
            <div data-ai="product-actions" className="space-y-3 mb-6 hidden md:block">
              <Button
                onClick={handleAddToCart}
                className="w-full min-h-[48px]"
                size="lg"
                disabled={isOutOfStock}
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                {isOutOfStock ? "Out of Stock" : "Add to Cart"}
              </Button>
              <Button onClick={handleShare} variant="outline" className="w-full min-h-[44px]">
                <Share2 className="w-4 h-4 mr-2" />
                Share Product
              </Button>
            </div>

            {/* Share Button - Mobile Only */}
            <div className="mb-6 md:hidden">
              <Button onClick={handleShare} variant="outline" className="w-full min-h-[44px]">
                <Share2 className="w-4 h-4 mr-2" />
                Share Product
              </Button>
            </div>

            {/* Product Details */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-3">Product Details</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Category:</dt>
                    <dd className="font-medium">{product.category}</dd>
                  </div>
                  {baseSku && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">SKU:</dt>
                      <dd data-ai="product-sku" className="font-medium">{baseSku}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Availability:</dt>
                    <dd data-ai="product-availability" className={`font-medium ${isOutOfStock ? "text-destructive" : "text-success"}`}>
                      {stockLabel}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <div data-ai="related-products" className="mt-16">
            <h2 data-ai="more-products-heading" className="text-2xl font-bold text-foreground mb-6">
              More Products
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard
                  key={relatedProduct.id}
                  id={relatedProduct.id}
                  slug={(relatedProduct as any).slug}
                  name={relatedProduct.name}
                  category={relatedProduct.category}
                  priceRange={relatedProduct.price_range}
                  base_price={relatedProduct.base_price}
                  offer_price={relatedProduct.offer_price}
                  variants={(relatedProduct as any).variants}
                  stock={(relatedProduct as any).stock}
                  images={relatedProduct.images}
                  status={relatedProduct.status}
                  storeSlug={isSubdomain ? undefined : storeSlug}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Sticky Bottom Bar with Add to Cart - Mobile Only */}
      <div data-ai="mobile-add-to-cart" className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-50 safe-area-inset-bottom">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Price and Variant Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {needsVariantSelection
                  ? "Select variant"
                  : (product.variants && product.variants.length > 0 && selectedVariant
                    ? `${selectedVariant}`
                    : product.name)}
              </p>
              <p className="text-lg font-bold text-primary">
                {needsVariantSelection ? "—" : `₹${(currentPrice * quantity).toFixed(2)}`}
              </p>
            </div>

            {/* Add to Cart Button */}
            <Button
              onClick={handleAddToCart}
              size="lg"
              className="min-h-[48px] px-6 font-semibold"
              disabled={isOutOfStock}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {isOutOfStock ? "Out of Stock" : "Add to Cart"}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmationModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-4"
             onClick={() => setShowConfirmationModal(false)}>
          <div className="bg-background rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-300"
               onClick={(e) => e.stopPropagation()}>
            {/* Product Image and Details */}
            <div className="flex gap-4 pb-4 border-b border-border">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={images[0]}
                  alt={generateProductImageAlt({
                    productName: product.name,
                    category: product.category,
                    imageIndex: 0
                  })}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                {selectedVariant && (
                  <p className="text-sm text-muted-foreground">Variant: {selectedVariant}</p>
                )}
                <p className="text-sm font-medium text-primary">₹{currentPrice} × {quantity}</p>
              </div>
            </div>

            {/* Total Price */}
            <div className="flex justify-between items-center py-3 border-b border-border">
              <span className="text-sm text-muted-foreground">Quantity:</span>
              <span className="font-semibold">{quantity}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-base font-semibold">Total:</span>
              <span className="text-xl font-bold text-primary">₹{(currentPrice * quantity).toFixed(2)}</span>
            </div>

            {/* Success Message */}
            <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
              </div>
              <span className="font-semibold">Added to cart</span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <Button
                onClick={() => {
                  setShowConfirmationModal(false);
                  navigate(isSubdomain ? '/cart' : `/${storeSlug}/cart`);
                }}
                className="w-full min-h-[48px] font-semibold"
              >
                View Cart
              </Button>
              <Button
                onClick={() => setShowConfirmationModal(false)}
                variant="outline"
                className="w-full min-h-[48px]"
              >
                Continue Shopping
              </Button>
            </div>
          </div>
        </div>
      )}

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

export default ProductDetail;
