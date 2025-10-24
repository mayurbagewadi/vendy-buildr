import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import { ChevronRight, MessageCircle, ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { generateOrderMessage, openWhatsApp } from "@/lib/whatsappUtils";
import { LocationPicker } from "@/components/customer/LocationPicker";
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

const Checkout = () => {
  const navigate = useNavigate();
  const { cart, cartTotal, clearCart } = useCart();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);

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

  useEffect(() => {
    checkLocationFeature();
    checkSubscriptionLimits();
  }, []);

  const checkSubscriptionLimits = async () => {
    try {
      setIsCheckingSubscription(true);
      
      // Get store ID from cart items
      if (cart.length === 0) {
        setIsCheckingSubscription(false);
        return;
      }

      const storeId = cart[0]?.storeId;
      if (!storeId) {
        setSubscriptionError("Invalid cart data. Please try again.");
        setIsCheckingSubscription(false);
        return;
      }

      const { data: storeData } = await supabase
        .from("stores")
        .select("id, user_id")
        .eq("id", storeId)
        .maybeSingle();

      if (!storeData) {
        setSubscriptionError("Store not found.");
        setIsCheckingSubscription(false);
        return;
      }

      // Check subscription status and limits
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select(`
          status,
          whatsapp_orders_used,
          website_orders_used,
          current_period_end,
          subscription_plans (
            whatsapp_orders_limit,
            website_orders_limit
          )
        `)
        .eq("user_id", storeData.user_id)
        .maybeSingle();

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

      // Check order limits - both WhatsApp and Website need to have available quota
      if (subscription.subscription_plans) {
        const whatsappLimit = subscription.subscription_plans.whatsapp_orders_limit;
        const whatsappUsed = subscription.whatsapp_orders_used || 0;
        const websiteLimit = subscription.subscription_plans.website_orders_limit;
        const websiteUsed = subscription.website_orders_used || 0;
        
        // Check if WhatsApp feature is disabled (null means disabled)
        if (whatsappLimit === null) {
          setSubscriptionError("WhatsApp ordering is not available in this store's plan.");
          setIsCheckingSubscription(false);
          return;
        }
        
        // Check if Website feature is disabled (null means disabled)
        if (websiteLimit === null) {
          setSubscriptionError("Website ordering is not available in this store's plan.");
          setIsCheckingSubscription(false);
          return;
        }
        
        // Check if WhatsApp limit is exceeded (0 means unlimited, positive number is the limit)
        if (whatsappLimit > 0 && whatsappUsed >= whatsappLimit) {
          setSubscriptionError("This store has reached its monthly WhatsApp order limit. Orders are currently unavailable.");
          setIsCheckingSubscription(false);
          return;
        }
        
        // Check if Website limit is exceeded (0 means unlimited, positive number is the limit)
        if (websiteLimit > 0 && websiteUsed >= websiteLimit) {
          setSubscriptionError("This store has reached its monthly website order limit. Orders are currently unavailable.");
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
          .select("id, user_id")
          .eq("id", storeId)
          .maybeSingle();

        if (!storeData) {
          setLocationEnabled(true);
          console.log("No store found, enabling location by default");
          return;
        }

        // Get the subscription plan for this store owner
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("plan_id, subscription_plans(enable_location_sharing)")
          .eq("user_id", storeData.user_id)
          .maybeSingle();

        const isEnabled = subscription?.subscription_plans?.enable_location_sharing || false;
        setLocationEnabled(isEnabled);
        console.log("Location feature enabled:", isEnabled, "for store:", storeData.id);
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
  };

  if (isCheckingSubscription) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
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
        <Header />
        <main className="flex-1 container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <ShoppingBag className="w-24 h-24 mx-auto mb-6 text-destructive" />
            <h1 className="text-3xl font-bold mb-4">Orders Unavailable</h1>
            <p className="text-muted-foreground mb-8">
              {subscriptionError}
            </p>
            <Link to="/home">
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
        <Header />
        <main className="flex-1 container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <ShoppingBag className="w-24 h-24 mx-auto mb-6 text-muted-foreground" />
            <h1 className="text-3xl font-bold mb-4">Your cart is empty</h1>
            <p className="text-muted-foreground mb-8">
              Add some products to proceed to checkout
            </p>
            <Link to="/products">
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

      // Check subscription expiration and limits for both WhatsApp and Website orders
      const { data: subscription } = await supabase
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
        .maybeSingle();

      // Check if subscription has expired
      if (subscription) {
        const now = new Date();
        const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
        
        if (periodEnd && periodEnd < now) {
          throw new Error("Your subscription has expired. Please upgrade your plan to continue accepting orders.");
        }

        // Check both WhatsApp and Website order limits
        if (subscription?.subscription_plans) {
          const whatsappLimit = subscription.subscription_plans.whatsapp_orders_limit;
          const whatsappUsed = subscription.whatsapp_orders_used || 0;
          const websiteLimit = subscription.subscription_plans.website_orders_limit;
          const websiteUsed = subscription.website_orders_used || 0;
          
          // Check if WhatsApp feature is disabled (null means disabled)
          if (whatsappLimit === null) {
            throw new Error("WhatsApp ordering is not available in your current plan.");
          }
          
          // Check if Website feature is disabled (null means disabled)
          if (websiteLimit === null) {
            throw new Error("Website ordering is not available in your current plan.");
          }
          
          // Check if WhatsApp limit is exceeded (0 means unlimited, positive number is the limit)
          if (whatsappLimit > 0 && whatsappUsed >= whatsappLimit) {
            throw new Error("WhatsApp order limit reached for this month. Please upgrade your plan or contact support.");
          }
          
          // Check if Website limit is exceeded (0 means unlimited, positive number is the limit)
          if (websiteLimit > 0 && websiteUsed >= websiteLimit) {
            throw new Error("Website order limit reached for this month. Please upgrade your plan or contact support.");
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
        payment_method: 'cod',
      };

      // Save order to Supabase
      const { data: insertedOrder, error: orderError } = await supabase
        .from("orders")
        .insert([orderRecord])
        .select('id')
        .single();

      if (orderError) throw orderError;

      // Increment both WhatsApp and Website orders count
      if (subscription) {
        await supabase
          .from("subscriptions")
          .update({
            whatsapp_orders_used: (subscription.whatsapp_orders_used || 0) + 1,
            website_orders_used: (subscription.website_orders_used || 0) + 1
          })
          .eq("user_id", storeData.user_id);
      }


      // Send order email notification (non-blocking)
      if (insertedOrder?.id) {
        supabase.functions.invoke('send-order-email', {
          body: {
            orderId: insertedOrder.id,
            storeId: storeData.id
          }
        }).catch(err => console.error('Failed to send order email:', err));
      }

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
      const result = await openWhatsApp(message);

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
        navigate("/home");
      }, 2000);
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/home" className="hover:text-foreground">Home</Link>
          <ChevronRight className="w-4 h-4" />
          <Link to="/cart" className="hover:text-foreground">Cart</Link>
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
                        <div className="space-y-2">
                          <Label>Share Your Location (Optional)</Label>
                          <LocationPicker 
                            onLocationSelect={handleLocationSelect} 
                            enabled={locationEnabled}
                          />
                          {location && (
                            <p className="text-sm text-success">✓ Location captured successfully</p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-xl font-semibold mb-4">Payment Method</h2>
                    <RadioGroup defaultValue="cod" disabled>
                      <div className="flex items-center space-x-2 border border-border rounded-lg p-4 bg-accent">
                        <RadioGroupItem value="cod" id="cod" />
                        <Label htmlFor="cod" className="flex-1 font-normal">
                          Cash on Delivery (COD)
                        </Label>
                      </div>
                    </RadioGroup>
                    <p className="text-sm text-muted-foreground mt-2">
                      Pay when you receive your order
                    </p>
                  </CardContent>
                </Card>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full md:w-auto"
                  disabled={isSubmitting}
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Place Order via WhatsApp
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
                  <p className="text-sm text-muted-foreground">
                    💵 Payment Method: Cash on Delivery
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Checkout;
