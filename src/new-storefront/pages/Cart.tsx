import { Link, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/new-storefront/components/StorefrontHeader";
import StoreFooter from "@/components/customer/StoreFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Minus, Plus, X, ShoppingBag, ChevronRight, Leaf, ShieldCheck } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import LazyImage from "@/components/ui/lazy-image";
import { isStoreSpecificDomain } from "@/lib/domainUtils";
import { useStorefront } from "@/contexts/StoreContext";
import { getStorefrontPageVariant } from "@/new-storefront/theme-engine/resolveTheme";

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

  // free_delivery_above IS in StoreContext — use it directly
  const freeDeliveryAbove = ctxStore?.free_delivery_above ?? null;

  const isSubdomain = isStoreSpecificDomain();
  const cartPageVariant = getStorefrontPageVariant(footerStore?.storefront_template, "cart");
  const isEditorialCart = cartPageVariant === "editorial-cart";

  // Only fetch the 3 delivery columns not covered by StoreContext.
  // Triggered once per store resolution — NOT on every cart change.
  useEffect(() => {
    const resolvedStoreId = ctxStore?.id ?? (cart.length > 0 ? cart[0].storeId : null);
    if (!resolvedStoreId) return;

    supabase
      .from("stores")
      .select("delivery_mode, delivery_fee_amount, delivery_tiers")
      .eq("id", resolvedStoreId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setDeliveryMode((data.delivery_mode as 'single' | 'multiple') || 'single');
        setDeliveryFeeAmount(data.delivery_fee_amount != null ? Number(data.delivery_fee_amount) : 0);
        setDeliveryTiers((data.delivery_tiers as { min: number | null; max: number | null; fee: number | null }[]) || []);
      });
  }, [ctxStore?.id, cart[0]?.storeId]);

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
  }, [cart]);

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

  if (cart.length === 0) {
    if (isEditorialCart) {
      return (
        <div className="flex min-h-screen flex-col bg-[#fbfaf6] text-stone-900">
          <Header storeSlug={storeSlug} storeId={cart[0]?.storeId} />
          <main className="flex-1">
            <section className="border-b border-stone-100 bg-gradient-to-b from-[#fbfaf6] via-white to-[#f5f1e8] px-4 py-20">
              <div className="mx-auto max-w-2xl text-center">
                <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50">
                  <ShoppingBag className="h-11 w-11 text-emerald-700" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">EcoSoap Basket</p>
                <h1 className="mt-3 font-serif text-4xl font-semibold text-stone-950">Your basket is waiting for botanicals</h1>
                <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-stone-500">
                  Add handmade bars and skincare blends to continue the EcoSoap Boutique checkout experience.
                </p>
                <Link to={productsLink}>
                  <Button size="lg" className="mt-8 rounded-full bg-stone-900 px-8 text-white hover:bg-emerald-800">
                    Continue Shopping
                  </Button>
                </Link>
              </div>
            </section>
          </main>
          {footer}
        </div>
      );
    }

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

  if (isEditorialCart) {
    return (
      <div className="flex min-h-screen flex-col bg-[#fbfaf6] text-stone-900">
        <Header storeSlug={storeSlug} storeId={cart[0]?.storeId} />

        <main className="flex-1">
          <section className="border-b border-stone-100 bg-gradient-to-b from-[#fbfaf6] via-white to-[#f5f1e8] px-4 py-12">
            <div className="mx-auto max-w-7xl">
              <nav className="mb-8 flex items-center gap-2 text-sm text-stone-500">
                <Link to={homeLink} className="hover:text-emerald-700">Home</Link>
                <ChevronRight className="h-4 w-4" />
                <span className="text-stone-800">EcoSoap Basket</span>
              </nav>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-700">
                    <Leaf className="h-4 w-4" />
                    Handpicked order
                  </p>
                  <h1 className="mt-2 font-serif text-4xl font-semibold text-stone-950 md:text-5xl">Your EcoSoap Basket</h1>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-500">
                    Review your selected botanicals, quantities, stock, and delivery before secure checkout.
                  </p>
                </div>
                <Link to={productsLink}>
                  <Button variant="outline" className="rounded-full border-stone-200 bg-white">
                    Continue Shopping
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          <section className="px-4 py-10">
            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="space-y-4">
                  {cart.map((item) => {
                    const stockInfo = cartStock[cartStockKey(item.productId, item.variant)];
                    const stockLimit = stockInfo?.stock ?? null;
                    const isUnavailable = stockInfo?.unavailable || stockLimit === 0;
                    const isAboveStock = stockLimit !== null && item.quantity > stockLimit;
                    const disableIncrease = stockLoading || isUnavailable || (stockLimit !== null && item.quantity >= stockLimit);

                    return (
                      <article key={`${item.productId}-${item.variant}`} className="overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm">
                        <div className="flex flex-col gap-5 p-4 sm:flex-row sm:p-6">
                          <LazyImage
                            src={item.productImage}
                            alt={item.productName}
                            className="aspect-square w-full rounded-xl object-cover sm:h-32 sm:w-32"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">Cured batch</p>
                                <h2 className="mt-1 font-serif text-xl font-semibold text-stone-950">{item.productName}</h2>
                                {item.variant && <p className="mt-1 text-sm text-stone-500">Batch: {item.variant}</p>}
                                {item.sku && <p className="mt-0.5 text-xs text-stone-400">SKU: {item.sku}</p>}
                                {isUnavailable ? (
                                  <p className="mt-2 text-sm font-semibold text-red-600">Out of stock</p>
                                ) : isAboveStock ? (
                                  <p className="mt-2 text-sm font-semibold text-red-600">Only {stockLimit} available. Please reduce quantity.</p>
                                ) : stockLimit !== null ? (
                                  <p className="mt-2 text-xs text-stone-500">Only {stockLimit} available</p>
                                ) : null}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(item.productId, item.variant)}
                                className="rounded-full text-stone-400 hover:text-red-600"
                              >
                                <X className="h-5 w-5" />
                              </Button>
                            </div>

                            <div className="mt-5 flex flex-col gap-4 border-t border-stone-50 pt-5 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex w-fit items-center rounded-full border border-stone-200 bg-stone-50">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="min-h-[44px] min-w-[44px] rounded-full"
                                  onClick={() => updateQuantity(item.productId, item.variant, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus className="h-5 w-5" />
                                </Button>
                                <span className="w-14 text-center text-lg font-semibold">{item.quantity}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="min-h-[44px] min-w-[44px] rounded-full"
                                  onClick={() => updateQuantity(item.productId, item.variant, item.quantity + 1)}
                                  disabled={disableIncrease}
                                >
                                  <Plus className="h-5 w-5" />
                                </Button>
                              </div>

                              <div className="text-left sm:text-right">
                                <p className="text-xs text-stone-500">Rs. {item.price} each</p>
                                <p className="font-serif text-2xl font-semibold text-emerald-700">Rs. {(item.price * item.quantity).toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <aside className="lg:col-span-1">
                <Card className="sticky top-24 rounded-2xl border-stone-100 bg-white shadow-sm">
                  <CardContent className="p-6">
                    <h2 className="font-serif text-2xl font-semibold text-stone-950">Order Ritual</h2>
                    <p className="mt-1 text-sm text-stone-500">Final check before your botanicals are packed.</p>

                    <div className="my-6 space-y-3">
                      <div className="flex justify-between text-sm text-stone-500">
                        <span>Subtotal ({cart.reduce((sum, item) => sum + item.quantity, 0)} items)</span>
                        <span>Rs. {cartTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-stone-500">
                        <span>Delivery</span>
                        {computedDeliveryFee > 0 ? (
                          <span>Rs. {computedDeliveryFee.toFixed(2)}</span>
                        ) : (
                          <span className="font-semibold text-emerald-700">FREE</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between border-t border-stone-100 pt-4">
                        <span className="font-semibold text-stone-900">Total</span>
                        <span className="font-serif text-3xl font-semibold text-emerald-700">Rs. {(cartTotal + computedDeliveryFee).toFixed(2)}</span>
                      </div>
                    </div>

                    {hasStockIssue && (
                      <p className="mb-3 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">
                        Please update unavailable items before checkout.
                      </p>
                    )}

                    <Button asChild={!hasStockIssue} className="min-h-[50px] w-full rounded-full bg-stone-900 text-white hover:bg-emerald-800" size="lg" disabled={hasStockIssue}>
                      {hasStockIssue ? (
                        <span>Update Basket to Checkout</span>
                      ) : (
                        <Link to={checkoutLink}>Proceed to Checkout</Link>
                      )}
                    </Button>

                    <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-800">
                        <ShieldCheck className="h-4 w-4" />
                        Same secure engine
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-emerald-950">
                        Stock checks and delivery rules are unchanged; this is the EcoSoap Boutique cart presentation.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </aside>
            </div>
          </section>
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
