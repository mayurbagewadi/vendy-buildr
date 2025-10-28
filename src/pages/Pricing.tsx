import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ErrorDisplay } from "@/components/customer/ErrorDisplay";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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

const Pricing = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    fetchPlans();
  }, []);

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

  return (
    <div className="min-h-screen bg-background">
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

                  <Link to="/auth" className="block mb-8">
                    <Button
                      size="lg"
                      className={`w-full font-semibold ${
                        plan.is_popular ? "shadow-lg" : ""
                      }`}
                      variant={plan.is_popular ? "default" : "outline"}
                    >
                      Get Started
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>

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
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>14-day free trial</span>
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
