import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, ArrowUpRight, Calendar, Package, Mail, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  yearly_price: number | null;
  features: string[];
  max_products: number | null;
  whatsapp_orders_limit: number | null;
  website_orders_limit: number | null;
  enable_location_sharing: boolean;
  enable_analytics: boolean;
  enable_order_emails: boolean;
}

interface UserSubscription {
  id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  trial_ends_at: string | null;
  next_billing_at: string | null;
  whatsapp_orders_used: number;
  website_orders_used: number;
  current_period_end: string | null;
  subscription_plans: SubscriptionPlan;
}

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actualOrderCount, setActualOrderCount] = useState(0);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Fetch store first to get store_id
      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("user_id", user.id)
        .single();

      // Count actual orders from the orders table
      if (store) {
        const { count } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("store_id", store.id);
        
        setActualOrderCount(count || 0);
      }

      // Fetch current subscription
      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq("user_id", user.id)
        .single();

      if (subError && subError.code !== "PGRST116") {
        throw subError;
      }

      if (subscription) {
        const formattedSubscription = {
          ...subscription,
          subscription_plans: {
            ...subscription.subscription_plans,
            features: Array.isArray(subscription.subscription_plans.features) 
              ? subscription.subscription_plans.features 
              : []
          }
        };
        setCurrentSubscription(formattedSubscription as UserSubscription);
      }

      // Fetch available plans
      const { data: plans, error: plansError } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (plansError) throw plansError;

      const formattedPlans = (plans || []).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : []
      }));

      setAvailablePlans(formattedPlans as SubscriptionPlan[]);
    } catch (error) {
      console.error("Error fetching subscription data:", error);
      toast.error("Failed to load subscription data");
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getWhatsAppUsagePercentage = () => {
    const limit = currentSubscription?.subscription_plans?.whatsapp_orders_limit;
    // If limit is null (feature disabled) or 0 (unlimited), don't show usage
    if (limit === null || limit === 0) return 0;
    const used = currentSubscription.whatsapp_orders_used || 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getWebsiteUsagePercentage = () => {
    const limit = currentSubscription?.subscription_plans?.website_orders_limit;
    // If limit is null (feature disabled) or 0 (unlimited), don't show usage
    if (limit === null || limit === 0) return 0;
    const used = actualOrderCount; // Use actual order count from orders table
    return Math.min((used / limit) * 100, 100);
  };

  const handleUpgrade = () => {
    navigate("/pricing");
  };

  const handleViewPlans = () => {
    navigate("/pricing");
  };

  if (loading) {
    return (
      <div className="pt-8">
        <p className="text-muted-foreground">Loading subscription details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/dashboard")}
          className="flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Subscription</h1>
          <p className="text-muted-foreground mt-1">Manage your subscription plan</p>
        </div>
      </div>

      {/* Current Plan */}
      {currentSubscription && (
        <Card className="p-6">
          <div className="mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {currentSubscription.subscription_plans.name}
                </h2>
                <Badge variant={currentSubscription.status === "active" ? "default" : "secondary"}>
                  {currentSubscription.status}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-foreground">
                  {formatPrice(
                    currentSubscription.billing_cycle === "yearly" && currentSubscription.subscription_plans.yearly_price
                      ? currentSubscription.subscription_plans.yearly_price
                      : currentSubscription.subscription_plans.monthly_price
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  /{currentSubscription.billing_cycle === "yearly" ? "year" : "month"}
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">
                  <span className="font-medium">Billing:</span>{" "}
                  {currentSubscription.billing_cycle === "yearly" ? "Yearly" : "Monthly"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">
                  <span className="font-medium">Expires:</span>{" "}
                  {formatDate(currentSubscription.current_period_end)}
                </span>
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {currentSubscription.subscription_plans.whatsapp_orders_limit !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">WhatsApp Orders</span>
                  <span className="text-sm text-muted-foreground">
                    {currentSubscription.subscription_plans.whatsapp_orders_limit === 0
                      ? `${currentSubscription.whatsapp_orders_used || 0} / Unlimited`
                      : `${currentSubscription.whatsapp_orders_used || 0} / ${currentSubscription.subscription_plans.whatsapp_orders_limit}`
                    }
                  </span>
                </div>
                <Progress value={getWhatsAppUsagePercentage()} className="h-2" />
              </div>
            )}

            {currentSubscription.subscription_plans.website_orders_limit !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Website Orders</span>
                  <span className="text-sm text-muted-foreground">
                    {currentSubscription.subscription_plans.website_orders_limit === 0
                      ? `${actualOrderCount} / Unlimited`
                      : `${actualOrderCount} / ${currentSubscription.subscription_plans.website_orders_limit}`
                    }
                  </span>
                </div>
                <Progress value={getWebsiteUsagePercentage() || 0} className="h-2" />
              </div>
            )}

            {currentSubscription.next_billing_at && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">Next billing: {formatDate(currentSubscription.next_billing_at)}</span>
                </div>
              </div>
            )}
            {currentSubscription.trial_ends_at && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">Trial ends: {formatDate(currentSubscription.trial_ends_at)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Current Plan Features */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-foreground mb-3">Plan Features</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {currentSubscription.subscription_plans.features
                .filter(f => f && typeof f === 'string' && f.trim() !== '')
                .map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
            </ul>
          </div>
        </Card>
      )}

      {/* Available Plans */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availablePlans.map((plan) => {
            const isCurrentPlan = currentSubscription?.plan_id === plan.id;

            return (
              <Card
                key={plan.id}
                className={`p-6 flex flex-col ${
                  isCurrentPlan ? "border-primary" : "border-border"
                }`}
              >
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  )}
                </div>

                <div className="mb-4">
                  <p className="text-3xl font-bold text-foreground">
                    {formatPrice(plan.monthly_price)}
                  </p>
                  <p className="text-sm text-muted-foreground">/month</p>
                </div>

                {/* Plan Features */}
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features
                    .filter(f => f && typeof f === 'string' && f.trim() !== '')
                    .slice(0, 5)
                    .map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </li>
                    ))}
                  {plan.whatsapp_orders_limit !== null && (
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">
                        {plan.whatsapp_orders_limit === 0 
                          ? 'Unlimited WhatsApp orders/month'
                          : `${plan.whatsapp_orders_limit} WhatsApp orders/month`
                        }
                      </span>
                    </li>
                  )}
                  {plan.website_orders_limit !== null && (
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">
                        {plan.website_orders_limit === 0 
                          ? 'Unlimited Website orders/month'
                          : `${plan.website_orders_limit} Website orders/month`
                        }
                      </span>
                    </li>
                  )}
                </ul>

                <Button
                  className="w-full"
                  variant={isCurrentPlan ? "outline" : "default"}
                  disabled={isCurrentPlan}
                  onClick={handleUpgrade}
                >
                  {isCurrentPlan ? "Current Plan" : (
                    <>
                      Upgrade Now <ArrowUpRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
