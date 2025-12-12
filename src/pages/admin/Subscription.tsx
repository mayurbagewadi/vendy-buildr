import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, ArrowUpRight, Calendar, Package, Mail, AlertTriangle, RefreshCw, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AdminLayout from "@/components/admin/AdminLayout";

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [renewalDate, setRenewalDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  // Real-time countdown timer
  useEffect(() => {
    if (!renewalDate) return;

    const updateCountdown = () => {
      const now = new Date();
      const diff = renewalDate.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown({ days, hours, minutes, seconds });
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [renewalDate]);

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

      // Fetch ALL subscriptions to find the correct current one
      const { data: allSubscriptions, error: subError } = await supabase
        .from("subscriptions")
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      // Find the correct current subscription by prioritizing:
      // 1. Active subscriptions (most recently updated)
      // 2. Non-expired trials
      // 3. Others
      let subscription = null;
      if (allSubscriptions && allSubscriptions.length > 0) {
        const now = new Date();
        
        // Filter out truly expired subscriptions (period ended AND status is trial/active)
        const validSubscriptions = allSubscriptions.filter(sub => {
          if (sub.status === 'cancelled' || sub.status === 'expired') return false;
          if (sub.current_period_end && new Date(sub.current_period_end) < now) return false;
          return true;
        });

        // Prioritize active over trial
        const activeSubscriptions = validSubscriptions.filter(s => s.status === 'active');
        if (activeSubscriptions.length > 0) {
          subscription = activeSubscriptions[0]; // Most recently updated active
        } else {
          subscription = validSubscriptions[0]; // Most recently updated valid subscription
        }
      }

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

        // Set renewal date for countdown
        if (subscription.current_period_end) {
          setRenewalDate(new Date(subscription.current_period_end));
        } else if (subscription.trial_ends_at) {
          setRenewalDate(new Date(subscription.trial_ends_at));
        }
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
    if (!currentSubscription) return 0;
    const limit = currentSubscription.subscription_plans?.whatsapp_orders_limit;
    // If limit is null (feature disabled) or 0 (unlimited), don't show usage
    if (limit === null || limit === 0) return 0;
    const used = currentSubscription.whatsapp_orders_used || 0;
    const percentage = (used / limit) * 100;
    console.log('WhatsApp Usage:', { used, limit, percentage });
    return Math.min(percentage, 100);
  };

  const getWebsiteUsagePercentage = () => {
    if (!currentSubscription) return 0;
    const limit = currentSubscription.subscription_plans?.website_orders_limit;
    // If limit is null (feature disabled) or 0 (unlimited), don't show usage
    if (limit === null || limit === 0) return 0;
    const used = currentSubscription.website_orders_used || 0;
    const percentage = (used / limit) * 100;
    console.log('Website Usage:', { used, limit, percentage });
    return Math.min(percentage, 100);
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 96) return "bg-red-600";
    if (percentage >= 81) return "bg-orange-500";
    if (percentage >= 51) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getWarningMessage = (percentage: number) => {
    if (percentage >= 100) return { level: "error", message: "Limit reached - Upgrade now!" };
    if (percentage >= 90) return { level: "warning", message: "Almost at limit" };
    if (percentage >= 80) return { level: "caution", message: "Running low on orders" };
    return null;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchSubscriptionData();
      toast.success("Refreshed! Order usage updated successfully.");
    } catch (error) {
      console.error('Error refreshing:', error);
      toast.error("Failed to refresh data. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUpgrade = () => {
    navigate("/pricing");
  };

  const handleViewPlans = () => {
    navigate("/pricing");
  };

  const isSubscriptionExpired = () => {
    if (!currentSubscription?.current_period_end) return false;
    return new Date(currentSubscription.current_period_end) < new Date();
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="pt-8">
          <p className="text-muted-foreground">Loading subscription details...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8 p-6 md:p-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Subscription</h1>
          <p className="text-muted-foreground mt-1">Manage your subscription plan</p>
        </div>

      {/* Subscription Status Card with Countdown */}
      {currentSubscription && countdown && renewalDate && !isSubscriptionExpired() && (
        <Card className={`border-l-4 ${currentSubscription.status === 'trial' ? 'border-l-warning bg-warning/5' : 'border-l-primary bg-primary/5'}`}>
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <Clock className={`w-5 h-5 mt-0.5 flex-shrink-0 ${currentSubscription.status === 'trial' ? 'text-warning' : 'text-primary'}`} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">
                  {currentSubscription.status === 'trial' ? 'Trial Status' : 'Subscription Status'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentSubscription.status === 'trial'
                    ? 'Your free trial ends in '
                    : 'Your subscription renews in '}
                  <span className="font-mono font-semibold text-foreground">
                    {countdown.days}d {countdown.hours}h {countdown.minutes}m {countdown.seconds}s
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expiration Warning */}
      {currentSubscription && isSubscriptionExpired() && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription className="ml-2">
            <span className="font-semibold">Your subscription has expired!</span> 
            {" "}Your store cannot accept new orders. Please upgrade your plan to continue using our services.
          </AlertDescription>
        </Alert>
      )}

      {/* Current Plan */}
      {currentSubscription && (
        <Card className="p-6">
          <div className="mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {currentSubscription.subscription_plans.name}
                </h2>
                <Badge variant={isSubscriptionExpired() ? "destructive" : currentSubscription.status === "active" ? "default" : "secondary"}>
                  {isSubscriptionExpired() ? "Expired" : currentSubscription.status}
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
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Order Usage</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {currentSubscription.subscription_plans.whatsapp_orders_limit !== null && (() => {
                const percentage = getWhatsAppUsagePercentage();
                const warning = getWarningMessage(percentage);
                return (
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
                    <div className="relative">
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${getProgressBarColor(percentage)}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    {warning && (
                      <Alert variant={warning.level === 'error' ? 'destructive' : 'default'}
                             className={`mt-2 ${warning.level === 'warning' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/50' : warning.level === 'caution' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/50' : ''}`}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="ml-2 text-sm font-medium">
                          {warning.message}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                );
              })()}

              {currentSubscription.subscription_plans.website_orders_limit !== null && (() => {
                const percentage = getWebsiteUsagePercentage();
                const warning = getWarningMessage(percentage);
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Website Orders</span>
                      <span className="text-sm text-muted-foreground">
                        {currentSubscription.subscription_plans.website_orders_limit === 0
                          ? `${currentSubscription.website_orders_used || 0} / Unlimited`
                          : `${currentSubscription.website_orders_used || 0} / ${currentSubscription.subscription_plans.website_orders_limit}`
                        }
                      </span>
                    </div>
                    <div className="relative">
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${getProgressBarColor(percentage)}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    {warning && (
                      <Alert variant={warning.level === 'error' ? 'destructive' : 'default'}
                             className={`mt-2 ${warning.level === 'warning' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/50' : warning.level === 'caution' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/50' : ''}`}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="ml-2 text-sm font-medium">
                          {warning.message}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

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
              {/* Max Products */}
              {currentSubscription.subscription_plans.max_products !== null && (
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">
                    {currentSubscription.subscription_plans.max_products === 0 
                      ? 'Unlimited Products'
                      : `Max ${currentSubscription.subscription_plans.max_products} Product${currentSubscription.subscription_plans.max_products === 1 ? '' : 's'}`
                    }
                  </span>
                </li>
              )}
              
              {/* Core features from JSONB - filter out controlled features */}
              {currentSubscription.subscription_plans.features
                .filter(f => {
                  if (!f || typeof f !== 'string' || f.trim() === '') return false;
                  const lower = f.toLowerCase();
                  // Exclude all features that should be controlled elsewhere
                  return !lower.includes('analytics') && 
                         !lower.includes('email') && 
                         !lower.includes('notification') &&
                         !lower.includes('location') &&
                         !lower.includes('tracking') &&
                         !lower.includes('product') &&
                         !lower.includes('support') &&
                         !lower.includes('whatsapp order') &&
                         !lower.includes('website order');
                })
                .map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              
              {/* Boolean flag features - only show if enabled */}
              {currentSubscription.subscription_plans.enable_analytics && (
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">Advanced Analytics</span>
                </li>
              )}
              {currentSubscription.subscription_plans.enable_order_emails && (
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">Email Notifications</span>
                </li>
              )}
              {currentSubscription.subscription_plans.enable_location_sharing && (
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">Location Tracking</span>
                </li>
              )}

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
                  {/* Max Products */}
                  {plan.max_products !== null && (
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">
                        {plan.max_products === 0 
                          ? 'Unlimited Products'
                          : `Max ${plan.max_products} Product${plan.max_products === 1 ? '' : 's'}`
                        }
                      </span>
                    </li>
                  )}
                  
                  {/* Core features from JSONB - filter out controlled features */}
                  {plan.features
                    .filter(f => {
                      if (!f || typeof f !== 'string' || f.trim() === '') return false;
                      const lower = f.toLowerCase();
                      // Exclude all features that should be controlled elsewhere
                      return !lower.includes('analytics') && 
                             !lower.includes('email') && 
                             !lower.includes('notification') &&
                             !lower.includes('location') &&
                             !lower.includes('tracking') &&
                             !lower.includes('product') &&
                             !lower.includes('support') &&
                             !lower.includes('whatsapp order') &&
                             !lower.includes('website order');
                    })
                    .map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </li>
                    ))}
                  
                  {/* Boolean flag features - only show if enabled */}
                  {plan.enable_analytics && (
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">Advanced Analytics</span>
                    </li>
                  )}
                  {plan.enable_order_emails && (
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">Email Notifications</span>
                    </li>
                  )}
                  {plan.enable_location_sharing && (
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">Location Tracking</span>
                    </li>
                  )}
                  
                  {/* Order limits */}
                  {plan.whatsapp_orders_limit !== null && (
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">
                        {plan.whatsapp_orders_limit === 0 
                          ? 'Unlimited WhatsApp orders/month'
                          : `${plan.whatsapp_orders_limit} WhatsApp order${plan.whatsapp_orders_limit === 1 ? '' : 's'}/month`
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
                          : `${plan.website_orders_limit} Website order${plan.website_orders_limit === 1 ? '' : 's'}/month`
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
    </AdminLayout>
  );
};

export default SubscriptionPage;
