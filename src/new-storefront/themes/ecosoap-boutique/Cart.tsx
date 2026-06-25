import { Link } from "react-router-dom";
import { ChevronRight, Leaf, Minus, Plus, ShieldCheck, ShoppingBag, X } from "lucide-react";

import StoreFooter from "@/components/customer/StoreFooter";
import StorefrontImage from "@/components/ui/storefront-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ThemeCartProps } from "@/new-storefront/theme-engine/types";

const EcoSoapCart = ({
  store,
  profile,
  storeSlug,
  cart,
  cartTotal,
  computedDeliveryFee,
  stockLoading,
  cartStock,
  hasStockIssue,
  links,
  cartStockKey,
  updateQuantity,
  removeItem,
}: ThemeCartProps) => {
  const storeAny = store as any;
  const profileAny = profile as any;

  const footer = (
    <StoreFooter
      storeName={storeAny?.name || storeSlug || "Store"}
      storeDescription={storeAny?.description}
      whatsappNumber={storeAny?.whatsapp_number}
      phone={profileAny?.phone}
      email={profileAny?.email}
      address={storeAny?.address}
      facebookUrl={storeAny?.facebook_url}
      instagramUrl={storeAny?.instagram_url}
      twitterUrl={storeAny?.twitter_url}
      youtubeUrl={storeAny?.youtube_url}
      linkedinUrl={storeAny?.linkedin_url}
      socialLinks={storeAny?.social_links}
      policies={storeAny?.policies}
    />
  );

  if (cart.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-[#fbfaf6] text-stone-900">
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
              <Link to={links.products}>
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
    <div className="flex min-h-screen flex-col bg-[#fbfaf6] text-stone-900">
      <main className="flex-1">
        <section className="border-b border-stone-100 bg-gradient-to-b from-[#fbfaf6] via-white to-[#f5f1e8] px-4 py-12">
          <div className="mx-auto max-w-7xl">
            <nav className="mb-8 flex items-center gap-2 text-sm text-stone-500">
              <Link to={links.home} className="hover:text-emerald-700">Home</Link>
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
              <Link to={links.products}>
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
                        <StorefrontImage
                          src={item.productImage}
                          alt={item.productName}
                          purpose="cart-thumb"
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
                      <Link to={links.checkout}>Proceed to Checkout</Link>
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
};

export default EcoSoapCart;
