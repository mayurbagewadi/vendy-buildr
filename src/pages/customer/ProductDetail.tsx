import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Header from "@/components/customer/Header";
import Footer from "@/components/customer/Footer";
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
import LazyImage from "@/components/ui/lazy-image";

import { getProductById, getPublishedProducts } from "@/lib/productData";
import { LoadingSpinner } from "@/components/customer/LoadingSpinner";
import ProductCard from "@/components/customer/ProductCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

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

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [quantity, setQuantity] = useState(0);
  const [selectedImage, setSelectedImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [storeSlug, setStoreSlug] = useState<string | undefined>(undefined);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);

  useEffect(() => {
    const loadProduct = async () => {
      if (!id) {
        navigate("/products");
        return;
      }

      try {
        setLoading(true);
        const data = await getProductById(id);
        
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
        
        // Fetch store slug for navigation
        const storeId = data.store_id;
        if (storeId) {
          const { data: storeData } = await supabase
            .from("stores")
            .select("slug")
            .eq("id", storeId)
            .single();
          
          if (storeData) {
            setStoreSlug(storeData.slug);
          }

          // Fetch related products from the same store
          const allStoreProducts = await getPublishedProducts(storeId);
          
          // Filter out current product
          const otherProducts = allStoreProducts.filter(p => p.id !== id);
          
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
        
        // Auto-select first variant if available
        if (data.variants && data.variants.length > 0) {
          setSelectedVariant(data.variants[0].name);
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
        setLoading(false);
      }
    };

    loadProduct();
  }, [id, navigate, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header storeSlug={storeSlug} storeId={product?.store_id || product?.storeId} />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading product..." />
        </div>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return null;
  }

  const currentVariant = product.variants?.find(v => v.name === selectedVariant);
  const currentPrice = currentVariant ? currentVariant.price : (product.basePrice || product.base_price || 0);
  const images = product.images && product.images.length > 0 ? product.images : ["/placeholder.svg"];
  const videoUrl = product.videoUrl || product.video_url;
  const baseSku = product.baseSku || product.sku;
  
  // Use store-specific routes if storeSlug is available
  const homeLink = storeSlug ? `/${storeSlug}` : "/home";
  const productsLink = storeSlug ? `/${storeSlug}/products` : "/products";

  const handleQuantityChange = (delta: number) => {
    setQuantity(Math.max(0, quantity + delta));
  };

  const handleAddToCart = () => {
    if (!product) return;

    const storeId = product.store_id;
    
    if (!storeId) {
      toast({
        title: "Error",
        description: "Unable to add product to cart. Store information is missing.",
        variant: "destructive",
      });
      return;
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

    toast({
      title: "Added to cart",
      description: `${product.name} ${selectedVariant ? `(${selectedVariant})` : ''} has been added to your cart.`,
    });
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
      <Header storeSlug={storeSlug} storeId={product.store_id || product.storeId} />

      <main className="flex-1 container mx-auto px-4 py-8">
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
                              alt={`${product.name} ${index + 1}`}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {images.length > 1 && (
                  <>
                    <CarouselPrevious className="left-2" />
                    <CarouselNext className="right-2" />
                  </>
                )}
              </Carousel>
              {images.length > 1 && (
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
                </div>
              )}
            </div>

            {/* Desktop: Thumbnail Gallery */}
            <div className="hidden lg:block">
              <Card className="overflow-hidden mb-4">
                <CardContent className="p-0">
                  <div className="aspect-square bg-muted">
                    <LazyImage
                      src={images[selectedImage]}
                      alt={product.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </CardContent>
              </Card>
              {images.length > 1 && (
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
                        alt={`${product.name} ${index + 1}`}
                        className="w-full h-full object-contain"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Video Player */}
            {videoUrl && (
              <div className="mt-4">
                <Card className="overflow-hidden">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3">Product Video</h3>
                    <div className="relative w-full pt-[56.25%]">
                      <iframe
                        className="absolute inset-0 w-full h-full rounded-lg"
                        src={`https://www.youtube.com/embed/${videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1] || videoUrl}`}
                        title="Product Video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
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
              <Card className="mb-6">
                <CardContent className="p-6">
                  <Label className="text-base font-semibold mb-4 block">
                    Select Variant
                  </Label>
                  <RadioGroup value={selectedVariant} onValueChange={setSelectedVariant}>
                    <div className="space-y-3">
                      {product.variants.map((variant) => (
                        <div
                          key={variant.name}
                          className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                        >
                          <RadioGroupItem value={variant.name} id={variant.name} />
                          <Label
                            htmlFor={variant.name}
                            className="flex-1 cursor-pointer font-normal"
                          >
                            <div className="flex justify-between items-center">
                              <span>{variant.name}</span>
                              <span className="font-semibold text-primary">
                                ₹{variant.price}
                              </span>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>

                  {selectedVariant && (
                    <div className="mt-4 p-4 bg-primary/10 rounded-lg">
                      <p className="text-sm font-semibold text-foreground">
                        Selected: {selectedVariant} - ₹{currentPrice}
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
                    disabled={quantity <= 0}
                  >
                    <Minus className="w-5 h-5" />
                  </Button>
                  <span className="w-16 text-center font-semibold text-lg">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="min-w-[44px] min-h-[44px]"
                    onClick={() => handleQuantityChange(1)}
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  Total: <span className="text-lg font-bold text-foreground">₹{currentPrice * quantity}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons - Touch Optimized */}
            <div className="space-y-3 mb-6">
              <Button 
                onClick={handleAddToCart} 
                className="w-full min-h-[48px]" 
                size="lg"
                disabled={quantity === 0}
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Add to Cart
              </Button>
              <Button onClick={handleShare} variant="ghost" className="w-full min-h-[44px]">
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
                  name={relatedProduct.name}
                  category={relatedProduct.category}
                  priceRange={relatedProduct.price_range}
                  images={relatedProduct.images}
                  status={relatedProduct.status}
                  storeSlug={storeSlug}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetail;
