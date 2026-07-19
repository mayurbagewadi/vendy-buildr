import { Link, useParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/new-storefront/components/StorefrontHeader";
import StoreFooter from "@/components/customer/StoreFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Minus, Plus, X, ShoppingBag, ChevronRight } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import StorefrontImage from "@/components/ui/storefront-image";
import { useStorefront } from "@/contexts/StoreContext";
import ThemeRenderBoundary from "@/new-storefront/theme-engine/ThemeRenderBoundary";
import { useActiveStorefrontThemeRuntime } from "@/new-storefront/theme-engine/resolveTheme";
import { buildThemeRuntimeContext } from "@/new-storefront/theme-engine/runtimeProps";
import { buildStorefrontUrls } from "@/new-storefront/theme-engine/storefrontUrls";

interface CartStockInfo {
  stock: number | null;
  unavailable: boolean;
}

interface CartProps {
  slug?: string;
}

const cartStockKey = (productId: string, variant?: string) => `${productId}::${variant || ""}`;

const parseStockValue = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const stock = Number(value);
  return Number.isFinite(stock) ? stock : null;
};

const Cart = ({ slug: slugProp }: CartProps = {}) => {
  const { slug: slugParam } = useParams<{ slug?: string }>();
  const slug = slugProp || slugParam;
  const { cart, cartTotal, updateQuantity, removeItem } = useCart();
  const { runtime: activeTheme } = useActiveStorefrontThemeRuntime();

  // ── StoreContext: provides store + profile — no full store fetch needed ──────
  const { store: ctxStore, profile: ctxProfile } = useStorefront();
  const footerStore   = ctxStore   as any;
  const footerProfile = ctxProfile as any;
  // storeSlug from context when available, fall back to route param
  const storeSlug = ctxStore?.slug ?? slug;

  // Delivery-specific fields are NOT in StoreContext — fetch only these 3 columns
  const [deliveryMode, setDeliveryMode]       = useState<'single' | 'multiple'>('single');
  const [deliveryFeeAmount, setDeliveryFeeAmount] = useState<number>(0);
  const [deliveryTiers, setDeliveryTiers]     = useState<{ min: number | null; max: number | null; fee: number | null }[]>([]);
  const [cartStock, setCartStock] = useState<Record<string, CartStockInfo>>({});
  const [stockLoading, setStockLoading] = useState(false);
  const [themeRenderFailed, setThemeRenderFailed] = useState(false);

  // free_delivery_above IS in StoreContext — use it directly
  const freeDeliveryAbove = ctxStore?.free_delivery_above ?? null;

  const storefrontUrls = buildStorefrontUrls({ slug: storeSlug });
  const ThemeCart = activeTheme?.components.Cart;
  const deliveryStoreId = ctxStore?.id ?? cart[0]?.storeId ?? null;
  const cartStockSignature = useMemo(
    () =>
      [...new Set(cart.map((item) => cartStockKey(item.productId, item.variant)))]
        .sort()
        .join("|"),
    [cart]
  );

  useEffect(() => {
    setThemeRenderFailed(false);
  }, [activeTheme?.id, activeTheme?.version]);

  // Only fetch the 3 delivery columns not covered by StoreContext.
  // Triggered once per store resolution — NOT on every cart change.
  useEffect(() => {
    if (!deliveryStoreId) return;

    supabase
      .from("stores")
      .select("delivery_mode, delivery_fee_amount, delivery_tiers")
      .eq("id", deliveryStoreId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setDeliveryMode((data.delivery_mode as 'single' | 'multiple') || 'single');
        setDeliveryFeeAmount(data.delivery_fee_amount != null ? Number(data.delivery_fee_amount) : 0);
        setDeliveryTiers((data.delivery_tiers as { min: number | null; max: number | null; fee: number | null }[]) || []);
      });
  }, [deliveryStoreId]);

  useEffect(() => {
    const productIds = [...new Set(cart.map((item) => item.productId))];
    if (productIds.length === 0) {
      setCartStock({});
      return;
    }

    let cancelled = false;
    setStockLoading(true);

    supabase
      .from("products")
      .select("id, stock, variants, status")
      .in("id", productIds)
      .then(({ data }) => {
        if (cancelled) return;

        const productMap = new Map((data || []).map((product: any) => [product.id, product]));
        const nextStock: Record<string, CartStockInfo> = {};

        for (const item of cart) {
          const product = productMap.get(item.productId) as any;
          const key = cartStockKey(item.productId, item.variant);

          if (!product || product.status !== "published") {
            nextStock[key] = { stock: 0, unavailable: true };
            continue;
          }

          if (item.variant) {
            const variant = Array.isArray(product.variants)
              ? product.variants.find((v: any) => v?.name === item.variant)
              : null;

            nextStock[key] = variant
              ? { stock: parseStockValue(variant.stock), unavailable: false }
              : { stock: 0, unavailable: true };
            continue;
          }

          nextStock[key] = {
            stock: parseStockValue(product.stock),
            unavailable: false,
          };
        }

        setCartStock(nextStock);
      })
      .finally(() => {
        if (!cancelled) setStockLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cartStockSignature]);

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

  const homeLink = storefrontUrls.home;
  const productsLink = storefrontUrls.products;
  const checkoutLink = storefrontUrls.checkout;
  const hasStockIssue = cart.some((item) => {
    const info = cartStock[cartStockKey(item.productId, item.variant)];
    return !!info && (info.unavailable || (info.stock !== null && item.quantity > info.stock));
  });

  const footer = (
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
  );

  if (ThemeCart && !themeRenderFailed) {
    return (
      <>
        <Header storeSlug={storeSlug} storeId={cart[0]?.storeId} />
        <ThemeRenderBoundary onError={() => setThemeRenderFailed(true)}>
          <ThemeCart
            store={ctxStore}
            profile={ctxProfile}
            storeSlug={storeSlug}
            cart={cart}
            cartTotal={cartTotal}
            computedDeliveryFee={computedDeliveryFee}
            stockLoading={stockLoading}
            cartStock={cartStock}
            hasStockIssue={hasStockIssue}
            links={{
              home: homeLink,
              products: productsLink,
              checkout: checkoutLink,
            }}
            cartStockKey={cartStockKey}
            updateQuantity={updateQuantity}
            removeItem={removeItem}
            urls={storefrontUrls}
            runtime={buildThemeRuntimeContext(activeTheme)}
            page={{ page: "cart" }}
          />
        </ThemeRenderBoundary>
      </>
    );
  }

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
        {footer}
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
              {cart.map((item) => {
                const stockInfo = cartStock[cartStockKey(item.productId, item.variant)];
                const stockLimit = stockInfo?.stock ?? null;
                const isUnavailable = stockInfo?.unavailable || stockLimit === 0;
                const isAboveStock = stockLimit !== null && item.quantity > stockLimit;
                const disableIncrease = stockLoading || isUnavailable || (stockLimit !== null && item.quantity >= stockLimit);

                return (
                <Card key={`${item.productId}-${item.variant}`}>
                  <CardContent className="p-4 md:p-6">
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <StorefrontImage
                        data-ai="cart-item-image"
                        src={item.productImage}
                        alt={item.productName}
                        purpose="cart-thumb"
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
                            {isUnavailable ? (
                              <p className="mt-1 text-sm font-medium text-destructive">Out of stock</p>
                            ) : isAboveStock ? (
                              <p className="mt-1 text-sm font-medium text-destructive">
                                Only {stockLimit} available. Please reduce quantity.
                              </p>
                            ) : stockLimit !== null ? (
                              <p className="mt-1 text-xs text-muted-foreground">Only {stockLimit} available</p>
                            ) : null}
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
                              disabled={disableIncrease}
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
              )})}
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
                      <span className="text-success font-medium">FREE</span>
                    )}
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between items-center">
                    <span data-ai="order-summary-labels" className="text-lg font-semibold">Total</span>
                    <span className="text-2xl font-bold text-primary">₹{(cartTotal + computedDeliveryFee).toFixed(2)}</span>
                  </div>
                </div>

                {hasStockIssue && (
                  <p className="mb-3 text-sm text-destructive">
                    Please update unavailable items before checkout.
                  </p>
                )}
                <Button data-ai="checkout-button" asChild={!hasStockIssue} className="w-full min-h-[48px]" size="lg" disabled={hasStockIssue}>
                  {hasStockIssue ? (
                    <span>Update Cart to Checkout</span>
                  ) : (
                    <Link to={checkoutLink}>
                      Proceed to Checkout
                    </Link>
                  )}
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

      {footer}
    </div>
  );
};

export default Cart;
