import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Header from "@/components/customer/Header";
import Footer from "@/components/customer/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, ShoppingCart, Share2, ChevronRight, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";

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
  basePrice?: number;
  baseSku?: string;
  variants?: Variant[];
  priceRange: string;
  status: string;
}

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    const products = JSON.parse(localStorage.getItem("products") || "[]");
    const found = products.find((p: Product) => p.id === id);
    
    if (!found) {
      navigate("/products");
      return;
    }

    setProduct(found);
    
    // Auto-select first variant if available
    if (found.variants && found.variants.length > 0) {
      setSelectedVariant(found.variants[0].name);
    }
  }, [id, navigate]);

  if (!product) {
    return null;
  }

  const currentVariant = product.variants?.find(v => v.name === selectedVariant);
  const currentPrice = currentVariant ? currentVariant.price : product.basePrice || 0;
  const images = product.images && product.images.length > 0 ? product.images : ["/placeholder.svg"];

  const handleQuantityChange = (delta: number) => {
    setQuantity(Math.max(1, quantity + delta));
  };

  const handleAddToCart = () => {
    if (!product) return;

    addToCart({
      productId: product.id,
      productName: product.name,
      productImage: images[0],
      variant: selectedVariant || undefined,
      price: currentPrice,
      quantity: quantity,
      sku: currentVariant?.sku || product.baseSku,
    });

    toast({
      title: "Added to cart",
      description: `${product.name} ${selectedVariant ? `(${selectedVariant})` : ''} has been added to your cart.`,
    });
  };

  const handleBuyWhatsApp = () => {
    const message = encodeURIComponent(
      `Hi, I'm interested in buying:\n\nProduct: ${product.name}\n` +
      `${selectedVariant ? `Variant: ${selectedVariant}\n` : ''}` +
      `Price: ₹${currentPrice}\n` +
      `Quantity: ${quantity}\n` +
      `Total: ₹${currentPrice * quantity}`
    );
    window.open(`https://wa.me/1234567890?text=${message}`, "_blank");
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
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/home" className="hover:text-foreground">Home</Link>
          <ChevronRight className="w-4 h-4" />
          <Link to="/products" className="hover:text-foreground">Products</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery */}
          <div>
            <Card className="overflow-hidden mb-4">
              <CardContent className="p-0">
                <div className="aspect-square bg-muted">
                  <img
                    src={images[selectedImage]}
                    alt={product.name}
                    className="w-full h-full object-cover"
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
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedImage === index
                        ? "border-primary"
                        : "border-transparent hover:border-border"
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
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
                  ₹{product.basePrice}
                </p>
              </div>
            )}

            {/* Quantity Selector */}
            <div className="mb-6">
              <Label className="text-base font-semibold mb-3 block">Quantity</Label>
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-border rounded-lg">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-12 text-center font-semibold">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleQuantityChange(1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  Total: <span className="text-lg font-bold text-foreground">₹{currentPrice * quantity}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 mb-6">
              <Button onClick={handleAddToCart} className="w-full" size="lg">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Add to Cart
              </Button>
              <Button onClick={handleBuyWhatsApp} variant="outline" className="w-full" size="lg">
                <MessageCircle className="w-5 h-5 mr-2" />
                Buy via WhatsApp
              </Button>
              <Button onClick={handleShare} variant="ghost" className="w-full">
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
                  {product.baseSku && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">SKU:</dt>
                      <dd className="font-medium">{product.baseSku}</dd>
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
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetail;
