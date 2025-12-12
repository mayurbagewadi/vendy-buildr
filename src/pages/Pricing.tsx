import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, ArrowRight, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ErrorDisplay } from "@/components/customer/ErrorDisplay";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  yearly_price: number | null;
  max_products: number | null;
  whatsapp_orders_limit: number | null;
  website_orders_limit: number | null;
  enable_location_sharing: boolean;
  enable_analytics: boolean;
  enable_order_emails: boolean;
  badge_text: string | null;
  badge_color: string | null;
  is_popular: boolean;
  trial_days: number;
}

// Declare Razorpay types
declare global {
  interface Window {
    Razorpay: any;
  }
}

const Pricing = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchPlans();
    loadRazorpayScript();
  }, []);

  const loadRazorpayScript = () => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  };

  const fetchPlans = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("monthly_price", { ascending: true });

      if (error) throw error;

      setPlans(data || []);
    } catch (err) {
      console.error("Error fetching plans:", err);
      setError("Failed to load pricing plans. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatPlanFeatures = (plan: SubscriptionPlan): string[] => {
    const features: string[] = [];

    // Max products
    if (plan.max_products) {
      features.push(`Up to ${plan.max_products.toLocaleString()} products`);
    } else {
      features.push('Unlimited products');
    }

    // WhatsApp orders
    if (plan.whatsapp_orders_limit !== null) {
      if (plan.whatsapp_orders_limit === 0) {
        features.push('Unlimited WhatsApp orders');
      } else {
        features.push(`${plan.whatsapp_orders_limit.toLocaleString()} WhatsApp orders/month`);
      }
    }

    // Website orders
    if (plan.website_orders_limit !== null) {
      if (plan.website_orders_limit === 0) {
        features.push('Unlimited website orders');
      } else {
        features.push(`${plan.website_orders_limit.toLocaleString()} website orders/month`);
      }
    }

    // Additional features
    if (plan.enable_location_sharing) {
      features.push('Location sharing for deliveries');
    }

    if (plan.enable_analytics) {
      features.push('Advanced analytics dashboard');
    }

    if (plan.enable_order_emails) {
      features.push('Email notifications');
    }

    // Trial period
    if (plan.trial_days > 0) {
      features.push(`${plan.trial_days}-day free trial`);
    }

    return features;
  };

  const handleGetStarted = async (plan: SubscriptionPlan) => {
    try {
      setProcessingPayment(plan.id);

      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Redirect to auth page
        navigate('/auth');
        return;
      }

      // Check if user already has an active or trial subscription
      const { data: existingSubs } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['active', 'trial'])
        .order('created_at', { ascending: false })
        .limit(1);

      const existingSub = existingSubs && existingSubs.length > 0 ? existingSubs[0] : null;

      if (existingSub && existingSub.status === 'active') {
        toast({
          title: "Already subscribed",
          description: "You already have an active subscription",
          variant: "destructive",
        });
        return;
      }

      // Calculate amount
      const amount = billingCycle === 'yearly' && plan.yearly_price
        ? plan.yearly_price
        : plan.monthly_price;

      // Create Razorpay order via Edge Function
      const { data: orderData, error: orderError } = await supabase.functions.invoke('razorpay-payment', {
        body: {
          action: 'create_order',
          plan_id: plan.id,
          billing_cycle: billingCycle,
          user_id: user.id,
        },
      });

      if (orderError || !orderData.success) {
        throw new Error(orderData?.error || 'Failed to create payment order');
      }

      // Get user details
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('user_id', user.id)
        .maybeSingle();

      // Open Razorpay checkout
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'StoreBuilder',
        description: `${plan.name} - ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`,
        order_id: orderData.order_id,
        prefill: {
          name: profile?.full_name || user.email,
          email: profile?.email || user.email,
          contact: profile?.phone || '',
        },
        theme: {
          color: '#3B82F6',
        },
        handler: async function (response: any) {
          console.log('🎉 Payment completed, verifying...', {
            order_id: response.razorpay_order_id,
            payment_id: response.razorpay_payment_id
          });

          try {
            // Show loading state
            toast({
              title: "Verifying payment...",
              description: "Please wait while we confirm your payment",
            });

            // Verify payment with retry logic
            let attempts = 0;
            let verifyData = null;
            let verifyError = null;

            while (attempts < 3) {
              const result = await supabase.functions.invoke('razorpay-payment', {
                body: {
                  action: 'verify_payment',
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  subscription_id: orderData.subscription_id,
                  user_id: user.id,
                },
              });

              verifyData = result.data;
              verifyError = result.error;

              if (!verifyError && verifyData?.success) {
                console.log('✅ Payment verified successfully');
                break;
              }

              attempts++;
              console.warn(`⚠️ Verification attempt ${attempts} failed, retrying...`);
              
              if (attempts < 3) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
              }
            }

            if (verifyError || !verifyData?.success) {
              console.error('❌ Payment verification failed after 3 attempts:', {
                error: verifyError,
                data: verifyData
              });
              throw new Error(verifyData?.error || 'Payment verification failed');
            }

            toast({
              title: "Payment successful! 🎉",
              description: "Your subscription has been activated. Redirecting...",
            });

            // Wait a moment before redirect to show success message
            setTimeout(() => {
              navigate('/admin/dashboard');
            }, 1500);

          } catch (error: any) {
            console.error('❌ Payment verification error:', error);
            toast({
              title: "Payment verification failed",
              description: error.message || "Please contact support with your payment details",
              variant: "destructive",
            });
            
            // Still redirect to dashboard so user can check subscription status
            setTimeout(() => {
              navigate('/admin/dashboard');
            }, 3000);
          } finally {
            setProcessingPayment(null);
          }
        },
        modal: {
          ondismiss: function() {
            setProcessingPayment(null);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: "Payment failed",
        description: error.message || "Unable to process payment",
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <ErrorDisplay message={error} onRetry={fetchPlans} />
      </div>
    );
  }

  // SEO Schema for pricing page
  const pricingSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Pricing Plans - DigitalDukandar",
    "description": "Affordable e-commerce platform pricing for Indian businesses. Start with free 14-day trial. Plans starting from ₹299/month with unlimited products, WhatsApp integration & analytics.",
    "url": "https://digitaldukandar.in/pricing"
  };

  return (
    <div className="min-h-screen bg-background">
      {/* SEO Meta Tags */}
      <Helmet>
        <title>Pricing Plans - Affordable Online Store Builder India | DigitalDukandar</title>
        <meta name="title" content="Pricing Plans - Affordable Online Store Builder India | DigitalDukandar" />
        <meta name="description" content="Flexible pricing for Indian entrepreneurs. Start FREE 14-day trial. Plans from ₹299/month. Unlimited products, WhatsApp orders, custom domain, analytics. No hidden fees. Cancel anytime." />
        <meta name="keywords" content="online store pricing India, e-commerce platform cost, affordable store builder, WhatsApp store pricing, small business e-commerce plans, digital store subscription India" />
        <link rel="canonical" content="https://digitaldukandar.in/pricing" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://digitaldukandar.in/pricing" />
        <meta property="og:title" content="Pricing Plans - Affordable Online Store Builder" />
        <meta property="og:description" content="Flexible pricing for Indian entrepreneurs. Start FREE 14-day trial. Plans from ₹299/month." />
        <meta property="og:image" content="https://digitaldukandar.in/logo.png" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Pricing Plans - Affordable Online Store Builder" />
        <meta name="twitter:description" content="Flexible pricing for Indian entrepreneurs. Start FREE 14-day trial. Plans from ₹299/month." />
        <meta name="twitter:image" content="https://digitaldukandar.in/logo.png" />

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(pricingSchema)}
        </script>
      </Helmet>

      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/60 rounded-2xl blur-sm opacity-70 group-hover:opacity-100 transition-opacity" />
              <div className="relative w-11 h-11 bg-gradient-to-br from-primary via-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all">
                <Crown className="w-6 h-6 text-primary-foreground" />
              </div>
            </div>
            <span className="font-playfair font-bold text-2xl bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              StoreBuilder
            </span>
          </Link>
          
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/">
              <Button variant="ghost" size="sm">
                Back to Home
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Pricing Section */}
      <section className="container mx-auto px-4 lg:px-8 py-24">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-block mb-4">
              <span className="text-sm font-semibold text-primary uppercase tracking-wider">Transparent Pricing</span>
            </div>
            <h1 className="font-playfair text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6">
              Choose Your Perfect Plan
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Simple, transparent pricing for your online store. Start free, upgrade as you grow.
            </p>
          </div>

          {/* Billing Toggle */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex items-center gap-3 bg-muted p-1.5 rounded-lg">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                  billingCycle === "monthly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                  billingCycle === "yearly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Yearly
                <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">
                  Save 20%
                </Badge>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {plans.map((plan) => {
              const price = billingCycle === "yearly" && plan.yearly_price 
                ? plan.yearly_price 
                : plan.monthly_price;
              
              const features = formatPlanFeatures(plan);

              return (
                <Card
                  key={plan.id}
                  className={`relative p-8 transition-all duration-300 bg-card ${
                    plan.is_popular
                      ? "border-2 border-primary shadow-2xl scale-105"
                      : "border hover:shadow-lg hover:-translate-y-1"
                  }`}
                >
                  {plan.is_popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground px-4 py-1.5 text-sm font-semibold shadow-lg">
                        {plan.badge_text || 'Most Popular'}
                      </Badge>
                    </div>
                  )}

                  <div className="mb-8">
                    <h3 className="font-playfair text-3xl font-bold text-foreground mb-4 tracking-tight">
                      {plan.name}
                    </h3>
                    {plan.description && (
                      <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                    )}
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-5xl font-semibold text-foreground tracking-tight">
                        ₹{price.toLocaleString()}
                      </span>
                      <span className="text-lg text-muted-foreground font-medium">
                        /{billingCycle === "monthly" ? "month" : "year"}
                      </span>
                    </div>
                    {billingCycle === "yearly" && plan.yearly_price && (
                      <p className="text-sm text-muted-foreground">
                        ₹{Math.round(plan.yearly_price / 12).toLocaleString()}/month billed annually
                      </p>
                    )}
                  </div>

                  <Button
                    size="lg"
                    className={`w-full font-semibold mb-8 ${
                      plan.is_popular ? "shadow-lg" : ""
                    }`}
                    variant={plan.is_popular ? "default" : "outline"}
                    onClick={() => handleGetStarted(plan)}
                    disabled={processingPayment === plan.id}
                  >
                    {processingPayment === plan.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Get Started
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <div className="space-y-4 pt-6 border-t">
                    <p className="text-sm font-semibold text-foreground mb-4">
                      Everything included:
                    </p>
                    {features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-green-500" />
                        </div>
                        <span className="text-sm text-foreground font-medium leading-relaxed">{feature}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Trust Section */}
          <div className="mt-20 text-center">
            <div className="inline-flex flex-wrap justify-center items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>Secure payment processing</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>Instant activation</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/20 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 StoreBuilder. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
