import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  yearly_price: number | null;
  features: string[];
  is_popular: boolean;
  badge_text: string | null;
  badge_color: string | null;
  display_order: number;
  max_products: number | null;
  trial_days: number | null;
  whatsapp_orders_limit: number | null;
  enable_location_sharing: boolean;
  enable_analytics: boolean;
  enable_order_emails: boolean;
}

const PricingSection = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      
      const formattedPlans = (data || []).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : []
      }));
      
      setPlans(formattedPlans as SubscriptionPlan[]);
    } catch (error) {
      console.error("Error fetching plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">Loading pricing plans...</p>
        </div>
      </section>
    );
  }

  if (plans.length === 0) {
    return null;
  }

  return (
    <section id="pricing" className="py-16 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Choose Your Plan
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Select the perfect plan for your business needs
          </p>
          
          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center gap-2 p-1 bg-background rounded-lg border">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                billingCycle === "yearly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
              {plans.some(p => p.yearly_price && p.yearly_price < p.monthly_price * 12) && (
                <span className="ml-2 text-xs">(Save more)</span>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const price = billingCycle === "yearly" && plan.yearly_price 
              ? plan.yearly_price 
              : plan.monthly_price;
            
            const pricePerMonth = billingCycle === "yearly" && plan.yearly_price
              ? plan.yearly_price / 12
              : plan.monthly_price;

            return (
              <Card
                key={plan.id}
                className={`relative p-8 flex flex-col ${
                  plan.is_popular
                    ? "border-primary shadow-lg scale-105"
                    : "border-border"
                }`}
              >
                {/* Popular Badge */}
                {plan.is_popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}

                {/* Custom Badge */}
                {plan.badge_text && !plan.is_popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge 
                      className="px-4 py-1"
                      style={plan.badge_color ? { backgroundColor: plan.badge_color } : undefined}
                    >
                      {plan.badge_text}
                    </Badge>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {plan.name}
                  </h3>
                  {plan.description && (
                    <p className="text-muted-foreground">{plan.description}</p>
                  )}
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-foreground">
                      {formatPrice(price)}
                    </span>
                    <span className="text-muted-foreground">
                      /{billingCycle === "yearly" ? "year" : "month"}
                    </span>
                  </div>
                  {billingCycle === "yearly" && (plan.yearly_price ?? 0) > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatPrice(pricePerMonth)}/month billed annually
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {Array.isArray(plan.features) && plan.features
                    .filter(f => f && typeof f === 'string' && f.trim() !== '' && f !== '0' && !['null', 'undefined'].includes(f.toLowerCase()))
                    .map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  {plan.enable_location_sharing && (
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">Location Sharing</span>
                    </li>
                  )}
                  {plan.enable_analytics && (
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">Analytics Dashboard</span>
                    </li>
                  )}
                  {plan.enable_order_emails && (
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">Order Email Notifications</span>
                    </li>
                  )}
                  {(plan.whatsapp_orders_limit ?? 0) > 0 && (
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">
                        {plan.whatsapp_orders_limit} WhatsApp orders/month
                      </span>
                    </li>
                  )}
                  {(plan.max_products ?? 0) > 0 && (
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">
                        Up to {plan.max_products} products
                      </span>
                    </li>
                  )}
                  {(plan.trial_days ?? 0) > 0 && (
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">
                        {plan.trial_days}-day free trial
                      </span>
                    </li>
                  )}
                </ul>

                <Button 
                  className="w-full" 
                  variant={plan.is_popular ? "default" : "outline"}
                  size="lg"
                >
                  Get Started
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
