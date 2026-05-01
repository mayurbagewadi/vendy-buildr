import { Link, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/customer/Header";
import StoreFooter from "@/components/customer/StoreFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Minus, Plus, X, ShoppingBag, ChevronRight } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import LazyImage from "@/components/ui/lazy-image";
import { isStoreSpecificDomain } from "@/lib/domainUtils";

interface CartProps {
  slug?: string;
}

const Cart = ({ slug: slugProp }: CartProps = {}) => {
  const { slug: slugParam } = useParams<{ slug?: string }>();
  const slug = slugProp || slugParam;
  const { cart, cartTotal, updateQuantity, removeItem } = useCart();
  const [storeSlug, setStoreSlug] = useState<string | undefined>(slug);
  const [deliveryMode, setDeliveryMode] = useState<'single' | 'multiple'>('single');
  const [deliveryFeeAmount, setDeliveryFeeAmount] = useState<number>(0);
  const [freeDeliveryAbove, setFreeDeliveryAbove] = useState<number | null>(null);
  const [deliveryTiers, setDeliveryTiers] = useState<{ min: number | null; max: number | null; fee: number | null }[]>([]);
  const [footerStore, setFooterStore] = useState<any>(null);
  const [footerProfile, setFooterProfile] = useState<any>(null);

  // Determine if we're on a store-specific domain (subdomain or custom domain)
  const isSubdomain = isStoreSpecificDomain();

  useEffect(() => {
    const fetchStoreData = async () => {
      let data: any = null;

      if (cart.length > 0) {
        const { data: storeData } = await supabase
          .from("stores")
          .select("slug, delivery_mode, delivery_fee_amount, free_delivery_above, delivery_tiers, name, description, whatsapp_number, address, facebook_url, instagram_url, twitter_url, youtube_url, linkedin_url, social_links, policies, user_id")
          .eq("id", cart[0].storeId)
          .maybeSingle();
        data = storeData;
      } else if (slug) {
        const normalizedSlug = slug.toLowerCase();
        let query = supabase
          .from("stores")
          .select("slug, delivery_mode, delivery_fee_amount, free_delivery_above, delivery_tiers, name, description, whatsapp_number, address, facebook_url, instagram_url, twitter_url, youtube_url, linkedin_url, social_links, policies, user_id")
          .eq("is_active", true);
        if (normalizedSlug.includes('.')) {
          query = query.or(`custom_domain.eq.${normalizedSlug},subdomain.eq.${normalizedSlug}`);
        } else {
          query = query.or(`subdomain.eq.${normalizedSlug},slug.eq.${normalizedSlug}`);
        }
        const { data: storeResults } = await query.limit(1);
        data = storeResults?.[0] ?? null;
      }

      if (!data) return;

      if (!slug) setStoreSlug(data.slug);
      setDeliveryMode((data.delivery_mode as 'single' | 'multiple') || 'single');
      setDeliveryFeeAmount(data.delivery_fee_amount != null ? Number(data.delivery_fee_amount) : 0);
      setFreeDeliveryAbove(data.free_delivery_above != null ? Number(data.free_delivery_above) : null);
      setDeliveryTiers((data.delivery_tiers as { min: number | null; max: number | null; fee: number | null }[]) || []);
      setFooterStore(data);
      if (data.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone, email")
          .eq("user_id", data.user_id)
          .maybeSingle();
        if (profile) setFooterProfile(profile);
      }
    };

    if (slug) setStoreSlug(slug);
    fetchStoreData();
  }, [slug, cart]);

  // Compute delivery fee
  const computedDeliveryFee = (() => {
    if (deliveryMode === 'multiple' && deliveryTiers.length > 0) {
      const matched = deliveryTiers.find(
        (t) => (t.min === null || cartTotal >= t.min) && (t.max === null || cartTotal <= t.max)
      );
      return matched?.fee ?? 0;
    }
    if (deliveryFeeAmount > 0 && (freeDeliveryAbove === null || cartTotal < freeDeliveryAbove)) {
      return deliveryFeeAmount;
    }
    return 0;
  })();

  // Generate store-aware links
  // On subdomain: /checkout, on main domain: /:slug/checkout
  const homeLink = isSubdomain ? "/" : (storeSlug ? `/${storeSlug}` : "/home");
  const productsLink = isSubdomain ? "/products" : (storeSlug ? `/${storeSlug}/products` : "/products");
  const checkoutLink = isSubdomain ? "/checkout" : (storeSlug ? `/${storeSlug}/checkout` : "/checkout");

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header storeSlug={storeSlug} storeId={cart[0]?.storeId} />
        <main className="flex-1 container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <ShoppingBag className="w-24 h-24 mx-auto mb-6 text-muted-foreground" />
            <h1 className="text-3xl font-bold mb-4">Your cart is empty</h1>
            <p className="text-muted-foreground mb-8">
              Add some products to your cart to see them here
            </p>
            <Link to={productsLink}>
              <Button size="lg">Continue Shopping</Button>
            </Link>
          </div>
        </main>
        <StoreFooter
          storeName={footerStore?.name || storeSlug || "Store"}
          storeDescription={footerStore?.description}
          whatsappNumber={footerStore?.whatsapp_number}
          phone={footerProfile?.phone}
          email={footerProfile?.email}
          address={footerStore?.address}
          facebookUrl={footerStore?.facebook_url}
          instagramUrl={footerStore?.instagram_url}
          twitterUrl={footerStore?.twitter_url}
          youtubeUrl={footerStore?.youtube_url}
          linkedinUrl={footerStore?.linkedin_url}
          socialLinks={footerStore?.social_links}
          policies={footerStore?.policies}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header storeSlug={storeSlug} storeId={cart[0]?.storeId} />

      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to={homeLink} className="hover:text-foreground">Home</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">Shopping Cart</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div data-ai="cart-items" className="lg:col-span-2">
            <h1 data-ai="cart-page-heading" className="text-3xl font-bold mb-6">Shopping Cart</h1>
            <div className="space-y-4">
              {cart.map((item) => (
                <Card key={`${item.productId}-${item.variant}`}>
                  <CardContent className="p-4 md:p-6">
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <LazyImage
                        data-ai="cart-item-image"
                        src={item.productImage}
                        alt={item.productName}
                        className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-lg flex-shrink-0"
                      />

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 data-ai="cart-item-name" className="font-semibold text-lg">{item.productName}</h3>
                            {item.variant && (
                              <p data-ai="cart-item-variant" className="text-sm text-muted-foreground">
                                Variant: {item.variant}
                              </p>
                            )}
                            {item.sku && (
                              <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                            )}
                          </div>
                          <Button
                            data-ai="remove-item-button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.productId, item.variant)}
                          >
                            <X className="w-5 h-5" />
                          </Button>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
                          {/* Quantity Controls - Touch Optimized */}
                          <div data-ai="quantity-buttons" className="flex items-center border border-border rounded-lg w-fit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="min-w-[44px] min-h-[44px]"
                              onClick={() =>
                                updateQuantity(
                                  item.productId,
                                  item.variant,
                                  item.quantity - 1
                                )
                              }
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="w-5 h-5" />
                            </Button>
                            <span className="w-14 text-center font-semibold text-lg">
                              {item.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="min-w-[44px] min-h-[44px]"
                              onClick={() =>
                                updateQuantity(
                                  item.productId,
                                  item.variant,
                                  item.quantity + 1
                                )
                              }
                            >
                              <Plus className="w-5 h-5" />
                            </Button>
                          </div>

                          {/* Price */}
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              ₹{item.price} each
                            </p>
                            <p data-ai="cart-item-price" className="text-xl font-bold text-primary">
                              ₹{item.price * item.quantity}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div data-ai="cart-summary" className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">Order Summary</h2>
                
                <div className="space-y-3 mb-6">
                  <div data-ai="order-summary-labels" className="flex justify-between text-muted-foreground">
                    <span>Subtotal ({cart.reduce((sum, item) => sum + item.quantity, 0)} items)</span>
                    <span>₹{cartTotal}</span>
                  </div>
                  <div data-ai="order-summary-labels" className="flex justify-between text-muted-foreground">
                    <span>Delivery</span>
                    {computedDeliveryFee > 0 ? (
                      <span>₹{computedDeliveryFee.toFixed(2)}</span>
                    ) : (
                      <span className="text-green-600 font-medium">FREE</span>
                    )}
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between items-center">
                    <span data-ai="order-summary-labels" className="text-lg font-semibold">Total</span>
                    <span className="text-2xl font-bold text-primary">₹{(cartTotal + computedDeliveryFee).toFixed(2)}</span>
                  </div>
                </div>

                <Button data-ai="checkout-button" asChild className="w-full min-h-[48px]" size="lg">
                  <Link to={checkoutLink}>
                    Proceed to Checkout
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full min-h-[44px] mt-3">
                  <Link to={productsLink}>
                    Continue Shopping
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <StoreFooter
        storeName={footerStore?.name || storeSlug || "Store"}
        storeDescription={footerStore?.description}
        whatsappNumber={footerStore?.whatsapp_number}
        phone={footerProfile?.phone}
        email={footerProfile?.email}
        address={footerStore?.address}
        facebookUrl={footerStore?.facebook_url}
        instagramUrl={footerStore?.instagram_url}
        twitterUrl={footerStore?.twitter_url}
        youtubeUrl={footerStore?.youtube_url}
        linkedinUrl={footerStore?.linkedin_url}
        socialLinks={footerStore?.social_links}
        policies={footerStore?.policies}
      />
    </div>
  );
};

export default Cart;
