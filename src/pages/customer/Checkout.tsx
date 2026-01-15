import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/customer/Header";
import Footer from "@/components/customer/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, MessageCircle, ShoppingBag, AlertTriangle, CreditCard, Smartphone, Wallet } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { generateOrderMessage, openWhatsApp } from "@/lib/whatsappUtils";
import { LocationPicker } from "@/components/customer/LocationPicker";
import { getAvailablePaymentMethods, PaymentMethod, PaymentGatewayCredentials } from "@/lib/payment";
import { openRazorpayCheckout, createRazorpayOrder, verifyRazorpayPayment } from "@/lib/payment/razorpay";
import { initiatePhonePePayment, verifyPhonePePayment } from "@/lib/payment/phonepe";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const checkoutSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit phone number"),
  email: z.string().trim().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().trim().min(10, "Address must be at least 10 characters").max(200),
  landmark: z.string().trim().max(100).optional(),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code"),
  deliveryTime: z.enum(["morning", "evening", "anytime"], {
    required_error: "Please select a delivery time",
  }),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

interface CheckoutProps {
  slug?: string;
}

const Checkout = ({ slug: slugProp }: CheckoutProps = {}) => {
  const { slug: slugParam } = useParams<{ slug?: string }>();
  const slug = slugProp || slugParam;
  const navigate = useNavigate();
  const { cart, cartTotal, clearCart } = useCart();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [forceLocationSharing, setForceLocationSharing] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState(false);
  const locationSectionRef = useRef<HTMLDivElement>(null);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);
  const [storeSlug, setStoreSlug] = useState<string | undefined>(slug);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitDetails, setLimitDetails] = useState<{
    planName: string;
    ordersUsed: number;
    ordersLimit: number;
    storeWhatsApp?: string;
  } | null>(null);

  // Payment-related state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'online_only' | 'online_and_cod'>('online_and_cod');
  const [paymentCredentials, setPaymentCredentials] = useState<PaymentGatewayCredentials>({});
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      address: "",
      landmark: "",
      pincode: "",
      deliveryTime: "anytime",
    },
  });

  // Load payment settings from store
  const loadPaymentSettings = async () => {
    try {
      if (cart.length === 0) return;

      const storeId = cart[0].storeId;
      const { data: store } = await supabase
        .from('stores')
        .select('payment_mode, payment_gateway_credentials')
        .eq('id', storeId)
        .maybeSingle();

      if (store) {
        const mode = (store.payment_mode as 'online_only' | 'online_and_cod') || 'online_and_cod';
        const credentials = (store.payment_gateway_credentials as PaymentGatewayCredentials) || {};

        setPaymentMode(mode);
        setPaymentCredentials(credentials);

        // Get available payment methods
        const availableMethods = getAvailablePaymentMethods(credentials, mode);
        setPaymentMethods(availableMethods);

        // Set default payment method (first available)
        if (availableMethods.length > 0) {
          setSelectedPaymentMethod(availableMethods[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading payment settings:', error);
      // Default to COD if error
      setPaymentMethods([{ id: 'cod', name: 'Cash on Delivery', icon: '💵', color: 'bg-gray-500', enabled: true }]);
      setSelectedPaymentMethod('cod');
    }
  };

  // Process Razorpay payment
  const processRazorpayPayment = async (orderDetails: {
    orderId: string;
    orderNumber: string;
    customerName: string;
    customerEmail?: string;
    customerPhone: string;
    amount: number;
    currency: string;
  }) => {
    try {
      setIsProcessingPayment(true);

      const storeId = cart[0]?.storeId;
      if (!storeId || !paymentCredentials.razorpay?.key_id) {
        throw new Error('Payment configuration error');
      }

      // Create Razorpay order
      const { orderId: razorpayOrderId, error: orderError } = await createRazorpayOrder(
        orderDetails.amount,
        orderDetails.currency,
        storeId
      );

      if (orderError) throw new Error(orderError);

      // Open Razorpay checkout
      const result = await openRazorpayCheckout(
        {
          ...orderDetails,
          orderId: razorpayOrderId
        },
        { key_id: paymentCredentials.razorpay.key_id },
        {
          onSuccess: async (response: any) => {
            // Redirect to payment success page for verification and WhatsApp redirect
            // Pass all necessary data via URL parameters

            // Debug log to verify Razorpay response
            console.log('Razorpay Success Response:', response);

            const params = new URLSearchParams({
              gateway: 'razorpay',
              orderId: orderDetails.orderId,
              storeId: storeId,
              paymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,  // ✅ FIXED: Use response object, not undefined variable
              signature: response.razorpay_signature,
              storeSlug: storeSlug || '',
            });

            console.log('Redirect params:', Object.fromEntries(params));

            // Use window.location.href for full page redirect (not navigate)
            window.location.href = `/payment-success?${params.toString()}`;
          },
          onFailure: (error: any) => {
            toast({
              title: "Payment failed",
              description: error.description || "Please try again.",
              variant: "destructive",
            });
            setIsProcessingPayment(false);
          },
          onDismiss: () => {
            setIsProcessingPayment(false);
          },
        }
      );

      if (!result.success && result.error) {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Razorpay payment error:', error);
      toast({
        title: "Payment failed",
        description: error.message || "Failed to process payment. Please try again.",
        variant: "destructive",
      });
      setIsProcessingPayment(false);
    }
  };

  // Process PhonePe payment
  const processPhonePePayment = async (orderDetails: {
    orderId: string;
    orderNumber: string;
    customerName: string;
    customerEmail?: string;
    customerPhone: string;
    amount: number;
    currency: string;
  }) => {
    try {
      setIsProcessingPayment(true);

      const storeId = cart[0]?.storeId;
      if (!storeId) {
        throw new Error('Payment configuration error');
      }

      // Update order with pending payment status before redirect
      await supabase
        .from('orders')
        .update({
          payment_status: 'pending',
          payment_gateway: 'phonepe',
        })
        .eq('id', orderDetails.orderId);

      // Initiate PhonePe payment (will redirect)
      const result = await initiatePhonePePayment(orderDetails, storeId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to initiate PhonePe payment');
      }

      // If we reach here, redirect didn't happen (shouldn't normally occur)
      // The initiatePhonePePayment function handles the redirect
    } catch (error: any) {
      console.error('PhonePe payment error:', error);
      toast({
        title: "Payment failed",
        description: error.message || "Failed to process payment. Please try again.",
        variant: "destructive",
      });
      setIsProcessingPayment(false);
    }
  };

  useEffect(() => {
    checkLocationFeature();
    checkSubscriptionLimits();
    loadPaymentSettings();

    // Get store slug from URL or cart items
    if (slug) {
      setStoreSlug(slug);
    } else if (cart.length > 0 && cart[0].storeId) {
      const fetchStoreSlug = async () => {
        const { data } = await supabase
          .from("stores")
          .select("slug")
          .eq("id", cart[0].storeId)
          .maybeSingle();
        if (data) {
          setStoreSlug(data.slug);
        }
      };
      fetchStoreSlug();
    }
  }, [slug, cart]);

  const checkSubscriptionLimits = async () => {
    try {
      setIsCheckingSubscription(true);

      // Get store ID from cart items
      if (cart.length === 0) {
        setIsCheckingSubscription(false);
        return;
      }

      const storeId = cart[0]?.storeId;

      // Validate storeId exists and is not empty
      if (!storeId || storeId.trim() === '') {
        console.error('Cart storeId is invalid:', storeId);
        setSubscriptionError("Unable to process your order. Please clear your cart and add products again from the store.");
        setIsCheckingSubscription(false);
        return;
      }

      const { data: storeData } = await supabase
        .from("stores")
        .select("id, user_id, whatsapp_number")
        .eq("id", storeId)
        .maybeSingle();

      if (!storeData) {
        setSubscriptionError("Store not found.");
        setIsCheckingSubscription(false);
        return;
      }

      // Check subscription status and limits (get active or trial subscription only)
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select(`
          status,
          whatsapp_orders_used,
          website_orders_used,
          current_period_end,
          subscription_plans (
            name,
            whatsapp_orders_limit,
            website_orders_limit
          )
        `)
        .eq("user_id", storeData.user_id)
        .in("status", ["active", "trial"])
        .order("created_at", { ascending: false })
        .limit(1);

      const subscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;

      if (!subscription) {
        setSubscriptionError("This store has no active subscription. Orders are currently unavailable.");
        setIsCheckingSubscription(false);
        return;
      }

      // Check if subscription is active or in trial
      if (!['active', 'trial'].includes(subscription.status)) {
        setSubscriptionError("This store's subscription is not active. Orders are currently unavailable.");
        setIsCheckingSubscription(false);
        return;
      }

      // Check if subscription has expired
      const now = new Date();
      const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
      
      if (periodEnd && periodEnd < now) {
        setSubscriptionError("This store's subscription has expired. Orders are currently unavailable.");
        setIsCheckingSubscription(false);
        return;
      }

      // Check order limits - store subscription info for later validation
      if (subscription.subscription_plans) {
        const whatsappLimit = subscription.subscription_plans.whatsapp_orders_limit;
        const whatsappUsed = subscription.whatsapp_orders_used || 0;
        const websiteLimit = subscription.subscription_plans.website_orders_limit;
        const websiteUsed = subscription.website_orders_used || 0;
        
        // Check if BOTH features are disabled - only then block orders entirely
        if (whatsappLimit === null && websiteLimit === null) {
          setSubscriptionError("Ordering is not available in this store's plan.");
          setIsCheckingSubscription(false);
          return;
        }
        
        // Check WhatsApp limit if feature is enabled
        const whatsappAvailable = whatsappLimit !== null && (whatsappLimit === 0 || whatsappUsed < whatsappLimit);
        
        // Check Website limit if feature is enabled  
        const websiteAvailable = websiteLimit !== null && (websiteLimit === 0 || websiteUsed < websiteLimit);
        
        // If both features are enabled but both limits are reached, show modal
        if (!whatsappAvailable && !websiteAvailable) {
          // Determine which limit to show (WhatsApp or Website)
          const limitType = whatsappLimit !== null ? 'whatsapp' : 'website';
          const ordersUsed = limitType === 'whatsapp' ? whatsappUsed : websiteUsed;
          const ordersLimit = limitType === 'whatsapp' ? whatsappLimit : websiteLimit;

          setLimitDetails({
            planName: subscription.subscription_plans.name || 'Current Plan',
            ordersUsed,
            ordersLimit: ordersLimit || 0,
            storeWhatsApp: storeData.whatsapp_number
          });
          setLimitModalOpen(true);
          setIsCheckingSubscription(false);
          return;
        }
      }

      // All checks passed
      setSubscriptionError(null);
      setIsCheckingSubscription(false);
    } catch (error) {
      console.error("Error checking subscription:", error);
      setSubscriptionError("Unable to verify store subscription. Please try again later.");
      setIsCheckingSubscription(false);
    }
  };

  const checkLocationFeature = async () => {
    try {
      // Get store ID from cart items if available
      if (cart.length > 0 && cart[0].storeId) {
        const storeId = cart[0].storeId;
        
        // Get store information
        const { data: storeData } = await supabase
          .from("stores")
          .select("id, user_id, force_location_sharing")
          .eq("id", storeId)
          .maybeSingle();

        if (!storeData) {
          setLocationEnabled(true);
          setForceLocationSharing(false);
          console.log("No store found, enabling location by default");
          return;
        }

        // Get the subscription plan for this store owner (active or trial only)
        const { data: subscriptions } = await supabase
          .from("subscriptions")
          .select("plan_id, subscription_plans(enable_location_sharing)")
          .eq("user_id", storeData.user_id)
          .in("status", ["active", "trial"])
          .order("created_at", { ascending: false })
          .limit(1);

        const subscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;

        const isEnabled = subscription?.subscription_plans?.enable_location_sharing || false;
        const isForced = (storeData.force_location_sharing as boolean) || false;
        setLocationEnabled(isEnabled);
        setForceLocationSharing(isForced);
        console.log("Location feature enabled:", isEnabled, "forced:", isForced, "for store:", storeData.id);
      } else {
        // Disable by default if no cart items
        setLocationEnabled(false);
      }
    } catch (error) {
      console.error("Error checking location feature:", error);
      // Disable by default on error to respect subscription limits
      setLocationEnabled(false);
    }
  };

  const handleLocationSelect = (latitude: number, longitude: number) => {
    setLocation({ latitude, longitude });
    setLocationError(false); // Clear error when location is shared
  };

  if (isCheckingSubscription) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header storeSlug={storeSlug} storeId={cart[0]?.storeId} />
        <main className="flex-1 container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <p className="text-muted-foreground">Checking availability...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (subscriptionError) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header storeSlug={storeSlug} storeId={cart[0]?.storeId} />
        <main className="flex-1 container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <ShoppingBag className="w-24 h-24 mx-auto mb-6 text-destructive" />
            <h1 className="text-3xl font-bold mb-4">Orders Unavailable</h1>
            <p className="text-muted-foreground mb-8">
              {subscriptionError}
            </p>
            <Link to={storeSlug ? `/${storeSlug}` : "/home"}>
              <Button size="lg">Back to Home</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
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
              Add some products to proceed to checkout
            </p>
            <Link to={storeSlug ? `/${storeSlug}/products` : "/products"}>
              <Button size="lg">Continue Shopping</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const onSubmit = async (data: CheckoutFormData) => {
    setIsSubmitting(true);

    // Validate location if required
    if (forceLocationSharing && !location) {
      // Scroll to location section smoothly
      locationSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // Trigger highlight animation
      setLocationError(true);

      setIsSubmitting(false);
      return;
    }

    const deliveryTimeText = {
      morning: "Morning (9 AM - 12 PM)",
      evening: "Evening (4 PM - 7 PM)",
      anytime: "Anytime",
    }[data.deliveryTime];

    try {
      // Get store ID from cart items
      const storeId = cart[0]?.storeId;

      if (!storeId || storeId.trim() === '') {
        toast({
          title: "Cart Error",
          description: "Your cart contains invalid items. Please clear your cart and add products again.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const { data: storeData } = await supabase
        .from("stores")
        .select("id, user_id")
        .eq("id", storeId)
        .maybeSingle();

      if (!storeData) throw new Error("Store not found");

      // Check subscription expiration and limits
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select(`
          whatsapp_orders_used,
          website_orders_used,
          current_period_end,
          status,
          subscription_plans (
            whatsapp_orders_limit,
            website_orders_limit
          )
        `)
        .eq("user_id", storeData.user_id)
        .in("status", ["active", "trial"])
        .order("created_at", { ascending: false })
        .limit(1);

      const subscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;

      // Check if subscription has expired
      if (subscription) {
        const now = new Date();
        const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;

        if (periodEnd && periodEnd < now) {
          throw new Error("Your subscription has expired. Please upgrade your plan to continue accepting orders.");
        }

        // Determine if this is a website order (online payment) or WhatsApp order (COD)
        const isOnlinePayment = selectedPaymentMethod !== 'cod';

        if (subscription?.subscription_plans) {
          if (isOnlinePayment) {
            // Check website order limits for online payments
            const websiteLimit = subscription.subscription_plans.website_orders_limit;
            const websiteUsed = subscription.website_orders_used || 0;

            if (websiteLimit === null) {
              throw new Error("Online ordering is not available in your current plan.");
            }

            if (websiteLimit > 0 && websiteUsed >= websiteLimit) {
              throw new Error("Website order limit reached for this month. Please contact the store or try COD.");
            }
          } else {
            // Check WhatsApp order limits for COD
            const whatsappLimit = subscription.subscription_plans.whatsapp_orders_limit;
            const whatsappUsed = subscription.whatsapp_orders_used || 0;

            if (whatsappLimit === null) {
              throw new Error("WhatsApp ordering is not available in your current plan.");
            }

            if (whatsappLimit > 0 && whatsappUsed >= whatsappLimit) {
              throw new Error("WhatsApp order limit reached for this month. Please try online payment.");
            }
          }
        }
      }

      // Generate order number
      const orderNumber = `ORD${Date.now().toString().slice(-8)}`;

      // Prepare order for database
      const orderRecord = {
        store_id: storeData.id,
        order_number: orderNumber,
        customer_name: data.fullName,
        customer_phone: data.phone,
        customer_email: data.email || null,
        delivery_address: data.address,
        delivery_landmark: data.landmark || null,
        delivery_pincode: data.pincode,
        delivery_time: deliveryTimeText,
        delivery_latitude: location?.latitude || null,
        delivery_longitude: location?.longitude || null,
        items: cart as any,
        subtotal: cartTotal,
        delivery_charge: 0,
        total: cartTotal,
        status: 'new',
        payment_method: selectedPaymentMethod,
        payment_status: selectedPaymentMethod === 'cod' ? 'pending' : 'pending',
        payment_gateway: selectedPaymentMethod === 'cod' ? 'cod' : selectedPaymentMethod,
      };

      // Save order to Supabase
      const { data: insertedOrder, error: orderError } = await supabase
        .from("orders")
        .insert(orderRecord)
        .select('id') // Only request the ID (primary key)
        .single();

      if (orderError) throw orderError;

      // Handle different payment methods
      if (selectedPaymentMethod === 'razorpay') {
        // Process Razorpay payment
        await processRazorpayPayment({
          orderId: insertedOrder.id,
          orderNumber,
          customerName: data.fullName,
          customerEmail: data.email,
          customerPhone: data.phone,
          amount: cartTotal,
          currency: 'INR',
        });
      } else if (selectedPaymentMethod === 'phonepe') {
        // Process PhonePe payment
        await processPhonePePayment({
          orderId: insertedOrder.id,
          orderNumber,
          customerName: data.fullName,
          customerEmail: data.email,
          customerPhone: data.phone,
          amount: cartTotal,
          currency: 'INR',
        });
      } else {
        // COD - WhatsApp flow
        // Prepare order details for WhatsApp
        const orderDetails = {
          customerName: data.fullName,
          phone: data.phone,
          email: data.email || undefined,
          address: data.address,
          landmark: data.landmark || undefined,
          pincode: data.pincode,
          deliveryTime: deliveryTimeText,
          latitude: location?.latitude,
          longitude: location?.longitude,
          cart: cart,
          subtotal: cartTotal,
          deliveryCharge: 0,
          total: cartTotal,
        };

        // Generate and send WhatsApp message
        const message = generateOrderMessage(orderDetails);
        const result = await openWhatsApp(message, undefined, storeId);

        if (!result.success) {
          toast({
            title: "WhatsApp Not Configured",
            description: result.error,
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        toast({
          title: "Order placed successfully!",
          description: "We'll contact you shortly on WhatsApp to confirm your order.",
        });

        clearCart();
        setTimeout(() => {
          navigate(storeSlug ? `/${storeSlug}` : "/home");
        }, 2000);
      }

      setIsSubmitting(false);
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: "Order failed",
        description: error.message || "Failed to place order. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const homeLink = storeSlug ? `/${storeSlug}` : "/home";
  const cartLink = storeSlug ? `/${storeSlug}/cart` : "/cart";

  return (
    <div className="min-h-screen flex flex-col">
      <Header storeSlug={storeSlug} storeId={cart[0]?.storeId} />

      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to={homeLink} className="hover:text-foreground">Home</Link>
          <ChevronRight className="w-4 h-4" />
          <Link to={cartLink} className="hover:text-foreground">Cart</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">Checkout</span>
        </nav>

        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Customer Information Form */}
          <div className="lg:col-span-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-xl font-semibold mb-4">Customer Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your full name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number *</FormLabel>
                            <FormControl>
                              <Input placeholder="10-digit mobile number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Email (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="your.email@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-xl font-semibold mb-4">Delivery Address</h2>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Complete Address *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="House/Flat No., Street, Area"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="landmark"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Landmark (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="Nearby location" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="pincode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>PIN Code *</FormLabel>
                              <FormControl>
                                <Input placeholder="6-digit PIN code" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="deliveryTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preferred Delivery Time *</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="space-y-2"
                              >
                                <div className="flex items-center space-x-2 border border-border rounded-lg p-3 hover:bg-accent transition-colors">
                                  <RadioGroupItem value="morning" id="morning" />
                                  <Label htmlFor="morning" className="flex-1 cursor-pointer font-normal">
                                    Morning (9 AM - 12 PM)
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2 border border-border rounded-lg p-3 hover:bg-accent transition-colors">
                                  <RadioGroupItem value="evening" id="evening" />
                                  <Label htmlFor="evening" className="flex-1 cursor-pointer font-normal">
                                    Evening (4 PM - 7 PM)
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2 border border-border rounded-lg p-3 hover:bg-accent transition-colors">
                                  <RadioGroupItem value="anytime" id="anytime" />
                                  <Label htmlFor="anytime" className="flex-1 cursor-pointer font-normal">
                                    Anytime
                                  </Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Location Sharing (if enabled) */}
                      {locationEnabled && (
                        <div
                          ref={locationSectionRef}
                          className={`space-y-3 p-4 rounded-lg border transition-all duration-300 ${
                            forceLocationSharing && !location ? 'animate-pulse-border' : ''
                          } ${
                            locationError ? 'animate-attention-shake border-destructive bg-destructive/5 shadow-lg shadow-destructive/20' : 'bg-card/50 backdrop-blur-sm hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Label className="text-base font-medium">Share Your Location</Label>
                            {forceLocationSharing ? (
                              <motion.span
                                className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20"
                                initial={{ scale: 0, x: -10 }}
                                animate={{ scale: 1, x: 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 15 }}
                              >
                                Required
                              </motion.span>
                            ) : (
                              <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                                Optional
                              </span>
                            )}
                          </div>

                          {forceLocationSharing && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              We need your location for accurate delivery
                            </p>
                          )}

                          <LocationPicker
                            onLocationSelect={handleLocationSelect}
                            enabled={locationEnabled}
                          />

                          <AnimatePresence mode="wait">
                            {location && (
                              <motion.div
                                className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-md"
                                initial={{ opacity: 0, scale: 0.8, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8, y: -10 }}
                                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Location captured successfully
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <AnimatePresence>
                            {locationError && !location && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md border border-destructive/20"
                              >
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Please share your location to continue - it's required for delivery
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-xl font-semibold mb-4">Payment Method</h2>

                    {paymentMethods.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Loading payment options...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {paymentMethods.map((method) => (
                          <motion.div
                            key={method.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            className={`relative cursor-pointer rounded-xl border-2 transition-all duration-300 overflow-hidden ${
                              selectedPaymentMethod === method.id
                                ? 'border-primary bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-lg shadow-primary/20'
                                : 'border-border hover:border-primary/40 bg-card hover:shadow-md'
                            }`}
                            onClick={() => setSelectedPaymentMethod(method.id)}
                          >
                            <div className="flex items-center gap-4 p-4 sm:p-5">
                              {/* Logo/Icon */}
                              <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md transition-transform duration-300 ${
                                selectedPaymentMethod === method.id ? 'scale-105' : ''
                              } ${method.color}`}>
                                {method.id === 'razorpay' && <CreditCard className="w-7 h-7 sm:w-8 sm:h-8 text-white" />}
                                {method.id === 'phonepe' && <Smartphone className="w-7 h-7 sm:w-8 sm:h-8 text-white" />}
                                {method.id === 'cod' && <Wallet className="w-7 h-7 sm:w-8 sm:h-8 text-white" />}
                              </div>

                              {/* Method Details */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-bold text-base sm:text-lg tracking-tight">
                                    {method.id === 'razorpay' && 'Paynow'}
                                    {method.id === 'phonepe' && 'Paynow'}
                                    {method.id === 'cod' && 'Cash on Delivery'}
                                  </h3>
                                  {(method.id === 'razorpay' || method.id === 'phonepe') && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                      Secure
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm text-muted-foreground leading-tight">
                                  {method.id === 'razorpay' && 'Pay with cards, UPI, net banking & wallets'}
                                  {method.id === 'phonepe' && 'Pay with UPI, cards & bank accounts'}
                                  {method.id === 'cod' && 'Pay cash when your order arrives'}
                                </p>
                              </div>

                              {/* Radio Button */}
                              <div className="flex-shrink-0">
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                                  selectedPaymentMethod === method.id
                                    ? 'border-primary bg-primary shadow-md'
                                    : 'border-muted-foreground/30 hover:border-primary/50'
                                }`}>
                                  {selectedPaymentMethod === method.id && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                                      className="w-3 h-3 rounded-full bg-white"
                                    />
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Selected indicator glow */}
                            {selectedPaymentMethod === method.id && (
                              <motion.div
                                layoutId="payment-indicator"
                                className="absolute inset-0 rounded-xl border-2 border-primary pointer-events-none"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              />
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {/* Payment info */}
                    {selectedPaymentMethod && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 p-3 bg-accent/50 rounded-lg border border-border"
                      >
                        <div className="flex items-start gap-2 text-sm">
                          <svg className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          <span className="text-muted-foreground">
                            {selectedPaymentMethod === 'cod' && 'No advance payment required. Pay cash when your order is delivered.'}
                            {(selectedPaymentMethod === 'razorpay' || selectedPaymentMethod === 'phonepe') && 'Your payment is secure and encrypted. Complete payment to confirm your order.'}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full md:w-auto"
                  disabled={isSubmitting || isProcessingPayment}
                >
                  {isProcessingPayment ? (
                    <>
                      <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    <>
                      {selectedPaymentMethod === 'cod' ? (
                        <>
                          <MessageCircle className="w-5 h-5 mr-2" />
                          Place Order via WhatsApp
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-5 h-5 mr-2" />
                          Proceed to Payment
                        </>
                      )}
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </div>

          {/* Order Review */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">Order Summary</h2>

                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {cart.map((item) => (
                    <div
                      key={`${item.productId}-${item.variant}`}
                      className="flex gap-3 pb-3 border-b border-border last:border-0"
                    >
                      <img
                        src={item.productImage}
                        alt={item.productName}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{item.productName}</h4>
                        {item.variant && (
                          <p className="text-xs text-muted-foreground">{item.variant}</p>
                        )}
                        <p className="text-sm font-semibold text-primary">
                          ₹{item.price} × {item.quantity}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 mb-4 pb-4 border-b border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Subtotal ({cart.reduce((sum, item) => sum + item.quantity, 0)} items)
                    </span>
                    <span>₹{cartTotal}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery</span>
                    <span className="text-success">FREE</span>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-2xl font-bold text-primary">₹{cartTotal}</span>
                </div>

                <div className="bg-accent p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    {selectedPaymentMethod === 'razorpay' && (
                      <>
                        <CreditCard className="w-4 h-4 text-blue-500" />
                        <p className="text-sm text-muted-foreground">
                          Payment via Razorpay
                        </p>
                      </>
                    )}
                    {selectedPaymentMethod === 'phonepe' && (
                      <>
                        <Smartphone className="w-4 h-4 text-purple-500" />
                        <p className="text-sm text-muted-foreground">
                          Payment via PhonePe
                        </p>
                      </>
                    )}
                    {selectedPaymentMethod === 'cod' && (
                      <>
                        <Wallet className="w-4 h-4 text-gray-500" />
                        <p className="text-sm text-muted-foreground">
                          Cash on Delivery
                        </p>
                      </>
                    )}
                    {!selectedPaymentMethod && (
                      <p className="text-sm text-muted-foreground">
                        Select payment method
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />

      {/* Order Limit Modal */}
      <Dialog open={limitModalOpen} onOpenChange={setLimitModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>Order Limit Reached</DialogTitle>
            </div>
            <DialogDescription className="pt-3 space-y-3">
              <p className="text-base">
                This store has reached its monthly order limit
              </p>
              {limitDetails && (
                <div className="bg-accent p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Plan:</span>
                    <span className="font-semibold">{limitDetails.planName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Orders Used:</span>
                    <span className="font-semibold">
                      {limitDetails.ordersUsed} of {limitDetails.ordersLimit}
                    </span>
                  </div>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                The store owner needs to upgrade their plan to accept more orders.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {limitDetails?.storeWhatsApp && (
              <Button
                onClick={() => {
                  window.open(`https://wa.me/${limitDetails.storeWhatsApp}`, '_blank');
                }}
                variant="default"
                className="w-full sm:w-auto"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Contact Store Owner
              </Button>
            )}
            <Button
              onClick={() => {
                setLimitModalOpen(false);
                navigate(storeSlug ? `/${storeSlug}` : '/');
              }}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Back to Store
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes pulse-border {
          0%, 100% { border-color: hsl(var(--border)); }
          50% { border-color: hsl(var(--primary) / 0.5); }
        }

        @keyframes attention-shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
          20%, 40%, 60%, 80% { transform: translateX(8px); }
        }

        .animate-pulse-border {
          animation: pulse-border 2s ease-in-out infinite;
        }

        .animate-attention-shake {
          animation: attention-shake 0.6s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Checkout;
