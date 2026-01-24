import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package,
  Plus,
  Eye,
  TrendingUp,
  ShoppingCart,
  Users,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Clock
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { toast } from "@/hooks/use-toast";
import { getProducts, initializeProducts } from "@/lib/productData";
import { supabase } from "@/integrations/supabase/client";
import { buildStoreUrl } from "@/lib/domainUtils";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    totalOrders: 0,
    totalCustomers: 0,
  });

  const [statsChange, setStatsChange] = useState({
    totalProductsChange: 0,
    activeProductsChange: 0,
    totalOrdersChange: 0,
    totalCustomersChange: 0,
  });

  const [storeName, setStoreName] = useState("Your Store");
  const [storeUrl, setStoreUrl] = useState("");
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);
  const [trialEndDate, setTrialEndDate] = useState<Date | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'trial' | 'active' | null>(null);
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [recentActivity, setRecentActivity] = useState<Array<{
    id: string;
    action: string;
    product: string;
    time: string;
  }>>([]);

  useEffect(() => {
    // Initialize products with seed data if empty
    initializeProducts();

    const initializeDashboard = async () => {
      // Single auth check for all operations
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch store once for all operations
      const { data: store } = await supabase
        .from('stores')
        .select('id, name, slug, subdomain, custom_domain')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!store) return;

      // Build store URL using domainUtils
      const baseUrl = buildStoreUrl(store.subdomain || store.slug, store.custom_domain);
      setStoreUrl(baseUrl);

      // Run all data fetching operations in parallel
      const [products, subscriptionResult, ordersCountResult, ordersResult] = await Promise.all([
        getProducts(),
        supabase
          .from('subscriptions')
          .select(`
            trial_ends_at,
            current_period_end,
            created_at,
            status,
            subscription_plans (trial_days)
          `)
          .eq('user_id', user.id)
          .in('status', ['active', 'trial'])
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('store_id', store.id),
        supabase
          .from('orders')
          .select('customer_email, customer_phone')
          .eq('store_id', store.id),
        // Update admin visit in background (don't wait for it)
        supabase
          .from('stores')
          .update({ last_admin_visit: new Date().toISOString() })
          .eq('id', store.id)
      ]);

      // Set store name
      if (store.name) {
        setStoreName(store.name);
      }

      // Calculate trial/subscription expiry countdown
      const subscriptions = subscriptionResult.data;
      const subscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;
      if (subscription) {
        let endDate: Date | null = null;

        // For trial subscriptions, use trial_ends_at
        if (subscription.status === 'trial') {
          if (subscription.trial_ends_at) {
            endDate = new Date(subscription.trial_ends_at);
          } else if (subscription.subscription_plans?.trial_days) {
            endDate = new Date(subscription.created_at);
            endDate.setDate(endDate.getDate() + subscription.subscription_plans.trial_days);
          }
        }
        // For active subscriptions, use current_period_end
        else if (subscription.status === 'active' && subscription.current_period_end) {
          endDate = new Date(subscription.current_period_end);
        }

        if (endDate) {
          const today = new Date();
          const diffTime = endDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays > 0) {
            setTrialDaysRemaining(diffDays);
            setTrialEndDate(endDate);
            setSubscriptionStatus(subscription.status as 'trial' | 'active');
          }
        }
      }

      // Calculate current stats
      const activeProducts = products.filter(p => p.status === 'published').length;
      const totalOrders = ordersCountResult.count || 0;

      let totalCustomers = 0;
      if (ordersResult.data) {
        const uniqueCustomers = new Set(
          ordersResult.data.map(order => order.customer_email || order.customer_phone)
        );
        totalCustomers = uniqueCustomers.size;
      }

      // Calculate previous month stats (30 days ago)
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

      const previousProducts = products.filter(p => {
        if (!p.createdAt) return false;
        const createdDate = new Date(p.createdAt);
        return createdDate < thirtyDaysAgo;
      });

      const previousActiveProducts = previousProducts.filter(p => p.status === 'published').length;

      const previousOrdersResult = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id)
        .lt('created_at', thirtyDaysAgo.toISOString());

      const previousTotalOrders = previousOrdersResult.count || 0;

      const previousOrdersDataResult = await supabase
        .from('orders')
        .select('customer_email, customer_phone')
        .eq('store_id', store.id)
        .lt('created_at', thirtyDaysAgo.toISOString());

      let previousTotalCustomers = 0;
      if (previousOrdersDataResult.data) {
        const uniqueCustomers = new Set(
          previousOrdersDataResult.data.map(order => order.customer_email || order.customer_phone)
        );
        previousTotalCustomers = uniqueCustomers.size;
      }

      // Calculate percentage changes
      const calculatePercentageChange = (current: number, previous: number): number => {
        if (previous === 0) {
          return current > 0 ? 100 : 0;
        }
        return Math.round(((current - previous) / previous) * 100);
      };

      const totalProductsChange = calculatePercentageChange(products.length, previousProducts.length);
      const activeProductsChange = calculatePercentageChange(activeProducts, previousActiveProducts);
      const totalOrdersChange = calculatePercentageChange(totalOrders, previousTotalOrders);
      const totalCustomersChange = calculatePercentageChange(totalCustomers, previousTotalCustomers);

      setStats({
        totalProducts: products.length,
        activeProducts,
        totalOrders,
        totalCustomers,
      });

      setStatsChange({
        totalProductsChange,
        activeProductsChange,
        totalOrdersChange,
        totalCustomersChange,
      });

      // Set recent activity
      const demoActivity = [
        {
          id: '1',
          action: 'Product published',
          product: products[0]?.name || 'Sample Product',
          time: '2 hours ago'
        },
        {
          id: '2',
          action: 'New order received',
          product: products[1]?.name || 'Sample Product',
          time: '5 hours ago'
        },
        {
          id: '3',
          action: 'Product updated',
          product: products[2]?.name || 'Sample Product',
          time: '1 day ago'
        }
      ];
      setRecentActivity(demoActivity);
    };

    initializeDashboard();
  }, []);

  // Real-time countdown timer
  useEffect(() => {
    if (!trialEndDate) return;

    const updateCountdown = () => {
      const now = new Date();
      const diff = trialEndDate.getTime() - now.getTime();

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
  }, [trialEndDate]);

  const quickActions = [
    {
      title: "Add New Product",
      description: "Create a new product listing",
      icon: Plus,
      action: () => navigate("/admin/products/add"),
      primary: true,
    },
    {
      title: "View All Products",
      description: "Manage your product catalog",
      icon: Eye,
      action: () => navigate("/admin/products"),
      primary: false,
    },
  ];

  const statCards = [
    {
      title: "Total Products",
      value: stats.totalProducts,
      change: statsChange.totalProductsChange,
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Active Products",
      value: stats.activeProducts,
      change: statsChange.activeProductsChange,
      icon: TrendingUp,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Total Orders",
      value: stats.totalOrders,
      change: statsChange.totalOrdersChange,
      icon: ShoppingCart,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Customers",
      value: stats.totalCustomers,
      change: statsChange.totalCustomersChange,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ];

  // Function to get change color based on positive/negative
  const getChangeColor = (change: number): string => {
    if (change > 0) return "text-success";
    if (change < 0) return "text-destructive";
    return "text-muted-foreground";
  };

  // Function to get change arrow based on positive/negative
  const getChangeArrow = (change: number) => {
    if (change > 0) return ArrowUpRight;
    if (change < 0) return ArrowDownRight;
    return ArrowUpRight;
  };

  // Function to format change text
  const formatChange = (change: number): string => {
    if (change > 0) return `+${change}%`;
    if (change < 0) return `${change}%`;
    return `${change}%`;
  };

  return (
    <AdminLayout>
      <div className="space-y-4 lg:space-y-6">
        {/* Subscription Status Alert */}
        {trialDaysRemaining !== null && trialDaysRemaining > 0 && countdown && subscriptionStatus && (
          <Card className={`border-l-4 ${subscriptionStatus === 'trial' ? 'border-l-warning bg-warning/5' : 'border-l-primary bg-primary/5'}`}>
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <Clock className={`w-5 h-5 mt-0.5 flex-shrink-0 ${subscriptionStatus === 'trial' ? 'text-warning' : 'text-primary'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">
                    {subscriptionStatus === 'trial' ? 'Trial Status' : 'Subscription Status'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {subscriptionStatus === 'trial'
                      ? 'Your free trial ends in '
                      : 'Your subscription renews in '}
                    <span className="font-mono font-semibold text-foreground">
                      {countdown.days}d {countdown.hours}h {countdown.minutes}m {countdown.seconds}s
                    </span>
                  </p>
                </div>
              </div>
              {subscriptionStatus === 'trial' && (
                <div className="flex flex-wrap gap-2 sm:ml-auto">
                  <Button size="sm" className="whitespace-nowrap" onClick={() => navigate("/admin/subscription")}>
                    Upgrade Now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Welcome back! 👋</h1>
            <p className="text-sm lg:text-base text-muted-foreground mt-1">
              Here's what's happening with <span className="font-medium text-primary">{storeName}</span> today.
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => {
            const changeColor = getChangeColor(stat.change);
            const ChangeArrow = getChangeArrow(stat.change);
            const changeText = formatChange(stat.change);

            return (
              <Card key={index} className="admin-stat-card group">
                <CardContent className="p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs lg:text-sm font-medium text-muted-foreground truncate">
                        {stat.title}
                      </p>
                      <p className="text-xl lg:text-2xl font-bold text-foreground mt-1 lg:mt-2">
                        {stat.value}
                      </p>
                      <p className={`flex items-center text-xs lg:text-sm ${changeColor} mt-0.5 lg:mt-1`}>
                        <ChangeArrow className="w-3 h-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{changeText} from last month</span>
                      </p>
                    </div>
                    <div className={`p-2 lg:p-3 rounded-xl ${stat.bgColor} group-hover:scale-110 transition-transform duration-200 flex-shrink-0 ml-2`}>
                      <stat.icon className={`w-5 h-5 lg:w-6 lg:h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Store URL Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Your Store URL
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-mono text-foreground break-all">
                {storeUrl || 'Loading...'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 sm:flex-initial"
                onClick={() => {
                  if (storeUrl) {
                    navigator.clipboard.writeText(storeUrl);
                    toast({
                      title: "Link copied!",
                      description: "Store URL copied to clipboard",
                    });
                  }
                }}
              >
                <Package className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 sm:flex-initial"
                onClick={() => {
                  if (storeUrl) {
                    // Generate QR code - open new window with QR code generator
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(storeUrl)}`;
                    window.open(qrUrl, '_blank');
                  }
                }}
              >
                <Eye className="w-4 h-4 mr-2" />
                Generate QR
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="admin-card">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Quick Actions</CardTitle>
            <p className="text-sm text-muted-foreground">Get started with these common tasks</p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quickActions.map((action, index) => (
              <Card key={index} className="admin-card cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/20" onClick={action.action}>
                <CardContent className="p-4 lg:p-6">
                  <div className="flex items-start gap-3 lg:gap-4">
                    <div className={`p-2 lg:p-3 rounded-lg flex-shrink-0 ${action.primary ? 'bg-primary/10' : 'bg-muted'}`}>
                      <action.icon className={`w-5 h-5 lg:w-6 lg:h-6 ${action.primary ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground mb-1 text-sm lg:text-base">
                        {action.title}
                      </h3>
                      <p className="text-xs lg:text-sm text-muted-foreground mb-3">
                        {action.description}
                      </p>
                      <Button 
                        variant={action.primary ? "default" : "outline"} 
                        size="sm"
                        className={`w-full sm:w-auto ${action.primary ? "admin-button-primary" : "admin-button-secondary"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          action.action();
                        }}
                      >
                        Get Started
                        <ArrowUpRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        {/* Getting Started Checklist */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <Star className="w-5 h-5 text-primary" />
                Getting Started
              </CardTitle>
              <span className="text-sm text-muted-foreground">2/4 complete</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 mt-2">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: '50%' }} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { done: true, text: "Create account" },
              { done: true, text: "Set up store" },
              { done: false, text: "Add first product" },
              { done: false, text: "Customize store appearance" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.done ? 'bg-success text-success-foreground' : 'bg-muted border-2 border-border'
                }`}>
                  {item.done && <span className="text-xs">✓</span>}
                </div>
                <span className={`text-sm ${item.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {item.text}
                </span>
              </div>
            ))}
            <Button className="w-full mt-4" size="sm">Complete Setup</Button>
          </CardContent>
        </Card>

        {/* Recent Activity & Tips */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Recent Activity</CardTitle>
              <p className="text-sm text-muted-foreground">Latest updates from your store</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm">{activity.action}</p>
                      <p className="text-sm text-muted-foreground truncate">{activity.product}</p>
                      <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No recent activity to display</p>
                  <p className="text-xs">Start by adding your first product!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tips & Resources */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Tips & Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { icon: "📺", text: "Video Tutorials", color: "text-red-500" },
                { icon: "📖", text: "Help Documentation", color: "text-blue-500" },
                { icon: "💬", text: "Contact Support", color: "text-green-500" },
                { icon: "🎓", text: "Best Practices Guide", color: "text-purple-500" }
              ].map((item, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  className="w-full justify-start hover:bg-muted"
                  size="sm"
                >
                  <span className="text-lg mr-3">{item.icon}</span>
                  <span className="text-sm">{item.text}</span>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;