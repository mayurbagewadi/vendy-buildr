import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Package,
  PackageSearch,
  Truck,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Header from "@/new-storefront/components/StorefrontHeader";
import StoreFooter from "@/components/customer/StoreFooter";
import { useStorefront } from "@/contexts/StoreContext";
import { supabase } from "@/integrations/supabase/client";
import { isStoreSpecificDomain } from "@/lib/domainUtils";
import { loadSavedCheckoutProfile } from "@/lib/checkoutProfile";
import { getImageUrl, type StorefrontImageSource } from "@/lib/responsiveImages";

type OrderItem = {
  name: string;
  variant: string | null;
  price: number;
  quantity: number;
  image: StorefrontImageSource;
};

type TrackingEvent = {
  status_label: string;
  location: string | null;
  message: string | null;
  happened_at: string | null;
};

type CustomerOrder = {
  order_number: string;
  created_at: string;
  status: string;
  payment_method: string;
  payment_status: string | null;
  payment_gateway: string | null;
  items: OrderItem[];
  subtotal: number;
  discount_amount: number;
  coupon_code: string | null;
  delivery_charge: number;
  gst_enabled: boolean;
  gst_show_on_summary: boolean;
  gst_rate: number;
  gst_amount: number;
  taxable_amount: number;
  total: number;
  delivery_time: string | null;
  customer_first_name: string;
  phone_masked: string;
  address_masked: string;
  pincode: string | null;
  shipping: {
    courier_name: string | null;
    awb: string | null;
    status: string | null;
    tracking_link: string | null;
    events: TrackingEvent[];
  };
};

const PHONE_RE = /^[6-9]\d{9}$/;
const PINCODE_RE = /^\d{6}$/;

const STEPS = [
  { label: "Placed", icon: ClipboardList },
  { label: "Processing", icon: Package },
  { label: "Shipped", icon: Truck },
  { label: "Delivered", icon: CheckCircle2 },
];

const SHIPPED_STATUSES = ["picked_up", "in_transit", "out_for_delivery", "manifested"];

const formatPrice = (value: number) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const formatDate = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
};

const getStepIndex = (order: CustomerOrder) => {
  if (order.status === "delivered" || order.shipping.status === "delivered") return 3;
  if (order.shipping.awb || SHIPPED_STATUSES.includes(order.shipping.status || "")) return 2;
  if (order.status === "processing") return 1;
  return 0;
};

const isPaymentPending = (order: CustomerOrder) => order.payment_status === "awaiting_payment";
const isPaymentFailed = (order: CustomerOrder) => order.payment_status === "failed";

const getStatusBadge = (order: CustomerOrder) => {
  if (order.status === "cancelled") return { label: "Cancelled", className: "bg-destructive/10 text-destructive" };
  if (isPaymentFailed(order)) return { label: "Payment Failed", className: "bg-destructive/10 text-destructive" };
  if (isPaymentPending(order)) return { label: "Payment Pending", className: "bg-orange-500/10 text-orange-700 dark:text-orange-400" };
  const step = getStepIndex(order);
  if (step === 3) return { label: "Delivered", className: "bg-green-500/10 text-green-700 dark:text-green-400" };
  if (step === 2) return { label: "Shipped", className: "bg-primary/10 text-primary" };
  if (step === 1) return { label: "Processing", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" };
  return { label: "Order Placed", className: "bg-muted text-foreground" };
};

const getPaymentLabel = (order: CustomerOrder) => {
  const isCod = order.payment_method?.toLowerCase() === "cod";
  const method = isCod ? "Cash on Delivery" : (order.payment_gateway || order.payment_method || "Online");
  const methodLabel = method.charAt(0).toUpperCase() + method.slice(1);
  if (order.payment_status === "completed") return `${methodLabel} · Paid`;
  if (isPaymentFailed(order)) return `${methodLabel} · Failed`;
  if (isPaymentPending(order)) return `${methodLabel} · Pending`;
  if (isCod) return `${methodLabel} · Pay on delivery`;
  return methodLabel;
};

// Reads the { error } body from a non-2xx edge function response.
const readFunctionError = async (error: unknown): Promise<string> => {
  try {
    const context = (error as { context?: { json?: () => Promise<{ error?: string }> } })?.context;
    const body = await context?.json?.();
    if (body?.error) return body.error;
  } catch {
    // fall through to generic message
  }
  return "Unable to load orders. Please try again.";
};

const MyOrder = () => {
  const { store, profile, storeSlug, loading } = useStorefront();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedOrderNumber = searchParams.get("order");

  const [phone, setPhone] = useState("");
  const [pincode, setPincode] = useState("");
  const [formError, setFormError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const autoLookupDone = useRef(false);

  const isSubdomain = isStoreSpecificDomain();
  const homeLink = isSubdomain ? "/" : `/${storeSlug}`;
  const productsLink = isSubdomain ? "/products" : `/${storeSlug}/products`;

  const lookupOrders = async (lookupPhone: string, lookupPincode: string) => {
    if (!store?.id) return;
    setIsSearching(true);
    setFormError("");

    try {
      const { data, error } = await supabase.functions.invoke("customer-order-lookup", {
        body: { store_id: store.id, phone: lookupPhone, pincode: lookupPincode },
      });

      if (error) {
        setFormError(await readFunctionError(error));
        setOrders(null);
        return;
      }

      const found: CustomerOrder[] = Array.isArray(data?.orders) ? data.orders : [];
      setOrders(found);

      if (found.length === 0) {
        setFormError("No orders found for this phone number and PIN code.");
        return;
      }

      const requested = requestedOrderNumber
        ? found.find((o) => o.order_number === requestedOrderNumber)
        : null;
      setSelectedOrder(requested || (found.length === 1 ? found[0] : null));
    } catch (lookupError) {
      console.error("My Order lookup failed:", lookupError);
      setFormError("Unable to load orders. Please check your internet and try again.");
      setOrders(null);
    } finally {
      setIsSearching(false);
    }
  };

  // Same device: checkout already saved this customer's phone + pincode,
  // so their orders load without typing anything.
  useEffect(() => {
    if (autoLookupDone.current || !store?.id) return;
    autoLookupDone.current = true;

    const saved = loadSavedCheckoutProfile();
    if (!saved) return;

    setPhone(saved.phone);
    setPincode(saved.pincode);
    if (PHONE_RE.test(saved.phone) && PINCODE_RE.test(saved.pincode)) {
      lookupOrders(saved.phone, saved.pincode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const cleanPincode = pincode.trim();

    if (!PHONE_RE.test(cleanPhone)) {
      setFormError("Enter a valid 10-digit phone number.");
      return;
    }
    if (!PINCODE_RE.test(cleanPincode)) {
      setFormError("Enter a valid 6-digit PIN code.");
      return;
    }

    setSelectedOrder(null);
    lookupOrders(cleanPhone, cleanPincode);
  };

  const resetLookup = () => {
    setOrders(null);
    setSelectedOrder(null);
    setFormError("");
    setPhone("");
    setPincode("");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!store) return null;

  const renderLookupForm = () => (
    <section data-ai="my-order-lookup" className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="mb-5 flex flex-col items-center text-center">
        <div className="mb-3 rounded-full bg-primary/10 p-3">
          <PackageSearch className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Find your orders</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the phone number and PIN code you used when placing the order.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="my-order-phone" className="text-sm font-medium text-foreground">Phone number</label>
          <Input
            id="my-order-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10-digit mobile number"
            maxLength={10}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="my-order-pincode" className="text-sm font-medium text-foreground">Delivery PIN code</label>
          <Input
            id="my-order-pincode"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="6-digit PIN code"
            maxLength={6}
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </div>

        {formError && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}

        <Button type="submit" className="w-full min-h-[44px]" disabled={isSearching}>
          {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageSearch className="mr-2 h-4 w-4" />}
          {isSearching ? "Searching..." : "View My Orders"}
        </Button>
      </form>
    </section>
  );

  const renderOrderList = (list: CustomerOrder[]) => (
    <section data-ai="my-order-list" className="mx-auto max-w-3xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-foreground">Your orders ({list.length})</h2>
        <button onClick={resetLookup} className="text-sm text-primary underline-offset-4 hover:underline">
          Use a different number
        </button>
      </div>
      {list.map((order) => {
        const badge = getStatusBadge(order);
        const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
        return (
          <button
            key={order.order_number}
            onClick={() => setSelectedOrder(order)}
            className="flex w-full items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary"
          >
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{order.order_number}</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(order.created_at)} · {itemCount} {itemCount === 1 ? "item" : "items"}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-bold text-foreground">{formatPrice(order.total)}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
            </div>
          </button>
        );
      })}
    </section>
  );

  const renderStatusBar = (order: CustomerOrder) => {
    if (order.status === "cancelled") {
      return (
        <div className="flex items-center gap-3 rounded-lg bg-destructive/10 p-4 text-destructive">
          <XCircle className="h-6 w-6 shrink-0" />
          <p className="font-medium">This order was cancelled. Contact the store if you have questions.</p>
        </div>
      );
    }

    if (isPaymentFailed(order)) {
      return (
        <div className="flex items-center gap-3 rounded-lg bg-destructive/10 p-4 text-destructive">
          <XCircle className="h-6 w-6 shrink-0" />
          <p className="font-medium">Payment failed. This order will not be processed. If money was deducted, contact the store.</p>
        </div>
      );
    }

    if (isPaymentPending(order)) {
      return (
        <div className="flex items-center gap-3 rounded-lg bg-orange-500/10 p-4 text-orange-700 dark:text-orange-400">
          <Clock className="h-6 w-6 shrink-0" />
          <p className="font-medium">Payment not completed yet. If money was deducted, contact the store with this order number.</p>
        </div>
      );
    }

    const current = getStepIndex(order);
    return (
      <ol className="grid grid-cols-4 gap-1" aria-label="Order progress">
        {STEPS.map((step, index) => {
          const done = index <= current;
          const Icon = step.icon;
          return (
            <li key={step.label} className="flex flex-col items-center text-center">
              <div className="flex w-full items-center">
                <span className={`h-1 flex-1 rounded ${index === 0 ? "invisible" : done ? "bg-primary" : "bg-muted"}`} />
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className={`h-1 flex-1 rounded ${index === STEPS.length - 1 ? "invisible" : index < current ? "bg-primary" : "bg-muted"}`} />
              </div>
              <span className={`mt-2 text-xs ${done ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    );
  };

  const renderOrderDetail = (order: CustomerOrder) => {
    const badge = getStatusBadge(order);
    const showGst = order.gst_enabled && order.gst_show_on_summary && order.gst_amount > 0;
    const { shipping } = order;

    return (
      <section data-ai="my-order-detail" className="mx-auto max-w-3xl space-y-5">
        {orders && orders.length > 1 ? (
          <Button variant="ghost" onClick={() => setSelectedOrder(null)} className="-ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            All orders
          </Button>
        ) : (
          <div className="text-right">
            <button onClick={resetLookup} className="text-sm text-primary underline-offset-4 hover:underline">
              Use a different number
            </button>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Order number</p>
              <p className="text-lg font-bold text-foreground">{order.order_number}</p>
              <p className="text-sm text-muted-foreground">Placed on {formatDate(order.created_at)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${badge.className}`}>{badge.label}</span>
          </div>
          <div className="mt-6">{renderStatusBar(order)}</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-foreground">Items</h3>
          <ul className="divide-y divide-border">
            {order.items.map((item, index) => (
              <li key={`${item.name}-${item.variant ?? ""}-${index}`} className="flex items-center gap-3 py-3">
                <img
                  src={getImageUrl(item.image)}
                  alt={item.name}
                  width={56}
                  height={56}
                  loading="lazy"
                  decoding="async"
                  className="h-14 w-14 shrink-0 rounded-md border border-border bg-muted object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{item.name}</p>
                  {item.variant && <p className="text-sm text-muted-foreground">{item.variant}</p>}
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(item.price)} × {item.quantity}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-foreground">{formatPrice(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="text-foreground">{formatPrice(order.subtotal)}</dd>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</dt>
                <dd className="text-green-600 dark:text-green-400">-{formatPrice(order.discount_amount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery</dt>
              <dd className="text-foreground">{order.delivery_charge > 0 ? formatPrice(order.delivery_charge) : "Free"}</dd>
            </div>
            {showGst && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">GST{order.gst_rate ? ` (${order.gst_rate}%)` : ""}</dt>
                <dd className="text-foreground">{formatPrice(order.gst_amount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <dt className="text-foreground">Total</dt>
              <dd className="text-foreground">{formatPrice(order.total)}</dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              Delivery
            </h3>
            <p className="text-sm text-foreground">{order.customer_first_name}</p>
            <p className="text-sm text-muted-foreground">{order.phone_masked}</p>
            {order.address_masked && <p className="text-sm text-muted-foreground">{order.address_masked}</p>}
            {order.pincode && <p className="text-sm text-muted-foreground">PIN {order.pincode}</p>}
            {order.delivery_time && <p className="mt-2 text-sm text-muted-foreground">Preferred time: {order.delivery_time}</p>}
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-semibold text-foreground">Payment</h3>
            <p className="text-sm text-foreground">{getPaymentLabel(order)}</p>
          </div>
        </div>

        {(shipping.awb || shipping.events.length > 0) && (
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
              <Truck className="h-4 w-4 text-primary" />
              Shipment
            </h3>
            <div className="space-y-1 text-sm">
              {shipping.courier_name && <p className="text-foreground capitalize">{shipping.courier_name}</p>}
              {shipping.awb && <p className="text-muted-foreground">Tracking number: <span className="font-mono">{shipping.awb}</span></p>}
              {shipping.status && <p className="text-muted-foreground capitalize">Status: {shipping.status.replace(/_/g, " ")}</p>}
            </div>

            {shipping.events.length > 0 && (
              <ol className="mt-4 space-y-3 border-l-2 border-border pl-4">
                {shipping.events.map((event, index) => (
                  <li key={`${event.happened_at}-${index}`} className="text-sm">
                    <p className="font-medium capitalize text-foreground">{event.status_label}</p>
                    {(event.location || event.message) && (
                      <p className="text-muted-foreground">{[event.location, event.message].filter(Boolean).join(" · ")}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{formatDate(event.happened_at)}</p>
                  </li>
                ))}
              </ol>
            )}

            {shipping.tracking_link && (
              <Button asChild variant="outline" className="mt-4">
                <a href={shipping.tracking_link} target="_blank" rel="noopener noreferrer">
                  Track on courier website
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        )}
      </section>
    );
  };

  const renderContent = () => {
    if (isSearching && !orders) {
      return (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    if (selectedOrder) return renderOrderDetail(selectedOrder);
    if (orders && orders.length > 0) return renderOrderList(orders);
    return renderLookupForm();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="container mx-auto mt-16 flex-1 px-4 py-8">
        <Button variant="ghost" onClick={() => navigate(homeLink)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Store
        </Button>

        <div className="mx-auto mb-8 max-w-3xl text-center">
          <h1 className="text-3xl font-bold text-foreground">My Order</h1>
          <p className="mt-2 text-muted-foreground">Check your order details and delivery status</p>
        </div>

        {renderContent()}

        {orders && orders.length === 0 && !isSearching && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Haven't ordered yet?{" "}
            <button onClick={() => navigate(productsLink)} className="text-primary underline-offset-4 hover:underline">
              Browse products
            </button>
          </p>
        )}
      </main>

      <StoreFooter
        storeName={store.name}
        storeDescription={store.description}
        whatsappNumber={store.whatsapp_number}
        phone={profile?.phone}
        email={profile?.email}
        address={store.address}
        facebookUrl={store.facebook_url}
        instagramUrl={store.instagram_url}
        twitterUrl={store.twitter_url}
        youtubeUrl={store.youtube_url}
        linkedinUrl={store.linkedin_url}
        socialLinks={store.social_links}
        policies={store.policies}
      />
    </div>
  );
};

export default MyOrder;
