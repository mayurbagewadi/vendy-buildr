import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Header from "@/components/customer/Header";
import StoreFooter from "@/components/customer/StoreFooter";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, ShoppingCart, Share2, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import { generateProductInquiryMessage, openWhatsApp } from "@/lib/whatsappUtils";
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

interface Variant {
  name: string;
  price: number;
  sku?: string;
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
  baseSku?: string;
  sku?: string;
  variants?: Variant[];
  priceRange?: string;
  price_range?: string;
  status: string;
  storeId?: string;
  store_id?: string;
}

interface ProductDetailProps {
  slug?: string;
}

const ProductDetail = ({ slug: slugProp }: ProductDetailProps = {}) => {
  // Handle both route patterns:
  // 1. /products/:slug (direct product view)
  // 2. /:slug/products/:productSlug (store-scoped product view)
  const params = useParams();
  const productSlug = params.productSlug || params.slug;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addToCart, triggerFlyAnimation } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const mainImageRef = useRef<HTMLImageElement>(null);
  const variantSectionRef = useRef<HTMLDivElement>(null);
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [storeSlug, setStoreSlug] = useState<string | undefined>(slugProp);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [storeData, setStoreData] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  // Determine if we're on a store-specific domain (subdomain or custom domain)
  const isSubdomain = isStoreSpecificDomain();

  useEffect(() => {
    const loadProduct = async () => {
      if (!productSlug) {
        navigate("/products");
        return;
      }

      try {
        setLoading(true);

        // Try to fetch by slug first (SEO-friendly URLs)
        let data = await getProductBySlug(productSlug);

        // Fallback: If slug doesn't work, try as UUID (backward compatibility)
        if (!data) {
          data = await getProductById(productSlug);

          // If found by UUID, redirect to slug URL (301 redirect for SEO)
          if (data && data.slug) {
            const isSubdomain = isStoreSpecificDomain();
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
        
        // Fetch store data for navigation and footer
        const storeId = data.store_id;
        if (storeId) {
          const { data: store } = await supabase
            .from("stores")
            .select("*")
            .eq("id", storeId)
            .single();

          if (store) {
            setStoreSlug(store.slug);
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
          }

          // Fetch related products from the same store
          const allStoreProducts = await getPublishedProducts(storeId);

          // Filter out current product
          const otherProducts = allStoreProducts.filter(p => p.id !== data.id);
          
          // Get products from same category first
          const sameCategoryProducts = otherProducts.filter(
            p => p.category === data.category
          );
          
          // If no products in same category, show all other products
          const recommended = sameCategoryProducts.length > 0 
            ? sameCategoryProducts 
            : otherProducts;
          
          setRelatedProducts(recommended);
        }

        // Don't auto-select variant - user must choose
        // Force conscious selection to prevent ordering wrong variant
      } catch (error) {
        console.error("Error loading product:", error);
        toast({
          title: "Error",
          description: "Failed to load product details",
          variant: "destructive",
        });
        navigate("/products");
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [productSlug, navigate, toast, storeSlug, isSubdomain]);

  // Remove pulse animation when variant is selected
  useEffect(() => {
    if (selectedVariant && variantSectionRef.current) {
      variantSectionRef.current.classList.remove('animate-pulse');
    }
  }, [selectedVariant]);

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
          availability: product.status === 'published' ? 'InStock' : 'OutOfStock',
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
    ? currentVariant.price
    : (product.basePrice || product.base_price || 0);

  const images = product.images && product.images.length > 0 ? product.images : ["/placeholder.svg"];
  const videoUrl = product.videoUrl || product.video_url;
  const baseSku = product.baseSku || product.sku;

  // Extract YouTube video ID and get thumbnail
  const getYouTubeVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    return match?.[1] || null;
  };

  const videoId = videoUrl ? getYouTubeVideoId(videoUrl) : null;
  const videoThumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  
  // Use store-specific routes if storeSlug is available
  const homeLink = storeSlug ? `/${storeSlug}` : "/home";
  const productsLink = storeSlug ? `/${storeSlug}/products` : "/products";

  const handleQuantityChange = (delta: number) => {
    setQuantity(Math.max(0, quantity + delta));
  };

  const handleAddToCart = () => {
    if (!product) return;

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

  const handleBuyWhatsApp = async () => {
    const storeId = product.store_id || product.storeId;
    const message = `🛍️ Hi! I want to buy:\n\n*${product.name}*\nVariant: ${selectedVariant || 'Standard'}\nQuantity: ${quantity}\nPrice: ₹${(currentPrice * quantity).toFixed(2)}\nSKU: ${currentVariant?.sku || baseSku || product.id}\n\nPlease confirm availability. Thank you! 😊`;
    const result = await openWhatsApp(message, undefined, storeId);

    if (!result.success) {
      toast({
        title: "WhatsApp Not Configured",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Redirecting to WhatsApp",
      description: "Complete your purchase via WhatsApp",
    });
  };

  const handleProductInquiry = async () => {
    const storeId = product.store_id || product.storeId;
    const inquiry = {
      productName: product.name,
      productId: product.id,
      variant: selectedVariant || undefined,
    };

    const message = generateProductInquiryMessage(inquiry);
    const result = await openWhatsApp(message, undefined, storeId);

    if (!result.success) {
      toast({
        title: "WhatsApp Not Configured",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Redirecting to WhatsApp",
      description: "Ask us anything about this product",
    });
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
        availability={product.status === 'published' ? 'in stock' : 'out of stock'}
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
          <div>
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
          <div>
            <div className="mb-4">
              <Badge variant="secondary" className="mb-2">{product.category}</Badge>
              <h1 className="text-3xl font-bold text-foreground mb-2">{product.name}</h1>
              <p className="text-muted-foreground">{product.description}</p>
            </div>

            {/* Variant Selection */}
            {product.variants && product.variants.length > 0 ? (
              <Card ref={variantSectionRef} className={`mb-6 ${!selectedVariant ? 'ring-2 ring-primary/50 ring-offset-2' : ''}`}>
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
                      {product.variants.map((variant) => (
                        <div
                          key={variant.name}
                          className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                            selectedVariant === variant.name
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50 hover:bg-accent'
                          }`}
                          onClick={() => setSelectedVariant(variant.name)}
                        >
                          <RadioGroupItem value={variant.name} id={variant.name} className="min-w-[20px] min-h-[20px]" />
                          <Label
                            htmlFor={variant.name}
                            className="flex-1 cursor-pointer font-normal"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{variant.name}</span>
                              <span className="font-bold text-primary text-lg">
                                ₹{variant.price}
                              </span>
                            </div>
                          </Label>
                        </div>
                      ))}
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
                <p className="text-3xl font-bold text-primary">
                  {product.price_range || product.priceRange || `₹${product.basePrice || product.base_price || 0}`}
                </p>
              </div>
            )}

            {/* Quantity Selector - Touch Optimized */}
            <div className="mb-6">
              <Label className="text-base font-semibold mb-3 block">Quantity</Label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center border border-border rounded-lg">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="min-w-[44px] min-h-[44px]"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1 || needsVariantSelection}
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
                    disabled={needsVariantSelection}
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
            <div className="space-y-3 mb-6 hidden md:block">
              <Button
                onClick={handleAddToCart}
                className="w-full min-h-[48px]"
                size="lg"
                disabled={quantity === 0}
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Add to Cart
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
                      <dd className="font-medium">{baseSku}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Availability:</dt>
                    <dd className="font-medium text-success">In Stock</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-foreground mb-6">
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-50 safe-area-inset-bottom">
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
              disabled={quantity === 0}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Add to Cart
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
                  <>
                    <p className="text-sm text-muted-foreground">Variant: {selectedVariant}</p>
                    <p className="text-sm font-medium text-primary">₹{currentPrice} × {quantity}</p>
                  </>
                )}
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
