import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  DollarSign,
  Package,
  ShoppingCart,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ArrowUpDown,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subDays, parseISO } from "date-fns";
import { motion } from "framer-motion";

interface AnalyticsData {
  totalRevenue: number;
  ordersCount: number;
  averageOrderValue: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  revenueByDay: Array<{ date: string; revenue: number }>;
  ordersByDay: Array<{ date: string; orders: number }>;
  previousRevenue?: number;
  previousOrdersCount?: number;
  previousAverageOrderValue?: number;
}

const Analytics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState("30"); // days
  const [refreshing, setRefreshing] = useState(false);
  const [sortField, setSortField] = useState<"revenue" | "quantity">("revenue");

  useEffect(() => {
    checkAccessAndLoadData();
  }, [period]);

  const checkAccessAndLoadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/admin/login");
        return;
      }

      // Check if user's plan has analytics enabled
      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("plan_id, status, subscription_plans(enable_analytics)")
        .eq("user_id", session.user.id)
        .maybeSingle();

      // Check if subscription exists and is active
      if (!subscription || subError) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      const analyticsEnabled = subscription?.subscription_plans?.enable_analytics || false;
      const isActiveSubscription = ['active', 'trial'].includes(subscription?.status);

      if (!analyticsEnabled || !isActiveSubscription) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      setHasAccess(true);
      await loadAnalytics();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: store, error: storeError } = await supabase
        .from("stores")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!store) return;

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(period));

      const previousPeriodStart = new Date();
      previousPeriodStart.setDate(previousPeriodStart.getDate() - parseInt(period) * 2);

      // Fetch current period
      const { data: orders, error } = await supabase
        .from("orders")
        .select("*")
        .eq("store_id", store.id)
        .gte("created_at", daysAgo.toISOString());

      if (error) throw error;

      // Fetch previous period for comparison
      const { data: previousOrders } = await supabase
        .from("orders")
        .select("*")
        .eq("store_id", store.id)
        .gte("created_at", previousPeriodStart.toISOString())
        .lt("created_at", daysAgo.toISOString());

      // Calculate current period analytics
      const totalRevenue = orders?.reduce((sum, order) => sum + order.total, 0) || 0;
      const ordersCount = orders?.length || 0;
      const averageOrderValue = ordersCount > 0 ? totalRevenue / ordersCount : 0;

      // Calculate previous period analytics
      const previousRevenue = previousOrders?.reduce((sum, order) => sum + order.total, 0) || 0;
      const previousOrdersCount = previousOrders?.length || 0;
      const previousAverageOrderValue = previousOrdersCount > 0 ? previousRevenue / previousOrdersCount : 0;

      // Calculate daily revenue and orders
      const dailyMap = new Map<string, { revenue: number; orders: number }>();
      orders?.forEach((order) => {
        const date = format(parseISO(order.created_at), "MMM dd");
        const existing = dailyMap.get(date) || { revenue: 0, orders: 0 };
        existing.revenue += order.total;
        existing.orders += 1;
        dailyMap.set(date, existing);
      });

      const revenueByDay = Array.from(dailyMap.entries())
        .map(([date, data]) => ({ date, revenue: data.revenue }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const ordersByDay = Array.from(dailyMap.entries())
        .map(([date, data]) => ({ date, orders: data.orders }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());


      // Calculate top products
      const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();

      orders?.forEach((order) => {
        if (Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const existing = productMap.get(item.productId) || {
              name: item.productName,
              quantity: 0,
              revenue: 0,
            };
            existing.quantity += item.quantity;
            existing.revenue += item.price * item.quantity;
            productMap.set(item.productId, existing);
          });
        }
      });

      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      setAnalytics({
        totalRevenue,
        ordersCount,
        averageOrderValue,
        topProducts,
        revenueByDay,
        ordersByDay,
        previousRevenue,
        previousOrdersCount,
        previousAverageOrderValue,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  };

  const calculateGrowth = (current: number, previous: number): { percent: number; isPositive: boolean } => {
    if (previous === 0) return { percent: 0, isPositive: current > 0 };
    return {
      percent: ((current - previous) / previous) * 100,
      isPositive: current >= previous,
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="inline-block"
          >
            <RefreshCw className="h-8 w-8 text-muted-foreground" />
          </motion.div>
          <p className="text-muted-foreground mt-4">Loading analytics...</p>
        </motion.div>
    );
  }

  if (!hasAccess) {
    return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto text-center py-12"
        >
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Analytics Not Available</h2>
          <p className="text-muted-foreground mb-6">
            You need a subscription plan with analytics enabled to access this feature.
          </p>
        </motion.div>
    );
  }

  const revenuGrowth = calculateGrowth(analytics?.totalRevenue || 0, analytics?.previousRevenue || 0);
  const ordersGrowth = calculateGrowth(analytics?.ordersCount || 0, analytics?.previousOrdersCount || 0);
  const avgValueGrowth = calculateGrowth(
    analytics?.averageOrderValue || 0,
    analytics?.previousAverageOrderValue || 0
  );

  const sortedProducts = [...(analytics?.topProducts || [])].sort((a, b) => {
    if (sortField === "revenue") return b.revenue - a.revenue;
    return b.quantity - a.quantity;
  });


  return (
    <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between border-b pb-6"
        >
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              Analytics
            </h1>
            <p className="text-muted-foreground mt-2">
              Monitor your store performance and sales trends
            </p>
          </div>
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <motion.div
                animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                transition={{ duration: refreshing ? 1 : 0.3, repeat: refreshing ? Infinity : 0 }}
              >
                <RefreshCw className="h-4 w-4" />
              </motion.div>
              Refresh
            </motion.button>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
                <SelectItem value="365">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Key Metrics */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid gap-4 md:grid-cols-3"
        >
          {/* Total Revenue Card */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden hover:shadow-lg transition-shadow"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-xl">
                  <DollarSign className="h-6 w-6 text-emerald-600" />
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${
                    revenuGrowth.isPositive
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                  }`}
                >
                  {revenuGrowth.isPositive ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  {Math.abs(revenuGrowth.percent).toFixed(1)}%
                </motion.div>
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Total Revenue</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(analytics?.totalRevenue || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">vs previous period</p>
            </div>
          </motion.div>

          {/* Total Orders Card */}
          <motion.div
            whileHover={{ y: -4, boxShadow: "0 20px 25px rgba(0,0,0,0.1)" }}
            transition={{ duration: 0.2 }}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring" }}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${
                    ordersGrowth.isPositive
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                  }`}
                >
                  {ordersGrowth.isPositive ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  {Math.abs(ordersGrowth.percent).toFixed(1)}%
                </motion.div>
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Total Orders</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {analytics?.ordersCount || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-2">vs previous period</p>
            </div>
          </motion.div>

          {/* Avg Order Value Card */}
          <motion.div
            whileHover={{ y: -4, boxShadow: "0 20px 25px rgba(0,0,0,0.1)" }}
            transition={{ duration: 0.2 }}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/20 dark:to-violet-800/20 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-violet-600" />
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${
                    avgValueGrowth.isPositive
                      ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400"
                      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                  }`}
                >
                  {avgValueGrowth.isPositive ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  {Math.abs(avgValueGrowth.percent).toFixed(1)}%
                </motion.div>
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Avg Order Value</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(analytics?.averageOrderValue || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">vs previous period</p>
            </div>
          </motion.div>
        </motion.div>

        {/* Revenue Trend Chart */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-xl">Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.revenueByDay && analytics.revenueByDay.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.revenueByDay}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="date"
                        stroke="#94a3b8"
                        style={{ fontSize: "12px" }}
                      />
                      <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "1px solid #475569",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#f1f5f9" }}
                        formatter={(value) => formatCurrency(value as number)}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={false}
                        fill="url(#colorRevenue)"
                        isAnimationActive={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No data available for this period
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Orders Trend Chart */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-xl">Order Volume</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.ordersByDay && analytics.ordersByDay.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.ordersByDay}>
                      <defs>
                        <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="date"
                        stroke="#94a3b8"
                        style={{ fontSize: "12px" }}
                      />
                      <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "1px solid #475569",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#f1f5f9" }}
                      />
                      <Bar
                        dataKey="orders"
                        fill="url(#colorOrders)"
                        radius={[8, 8, 0, 0]}
                        isAnimationActive={true}
                      />
                    </BarChart>
                  </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No data available for this period
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Products Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl">Top Products</CardTitle>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() =>
                  setSortField(sortField === "revenue" ? "quantity" : "revenue")
                }
                className="inline-flex items-center gap-2 px-3 py-1 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <ArrowUpDown className="h-4 w-4" />
                Sort by {sortField === "revenue" ? "Quantity" : "Revenue"}
              </motion.button>
            </CardHeader>
            <CardContent>
              {sortedProducts && sortedProducts.length > 0 ? (
                <div className="space-y-2">
                  {sortedProducts.map((product, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.05 }}
                      whileHover={{ x: 4, backgroundColor: "var(--slate-50)" }}
                      className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800 transition-all"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {product.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {product.quantity} units sold
                        </p>
                      </div>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.6 + index * 0.05 }}
                        className="text-right"
                      >
                        <p className="text-lg font-bold text-emerald-600">
                          {formatCurrency(product.revenue)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {((product.revenue / (analytics?.totalRevenue || 1)) * 100).toFixed(1)}%
                        </p>
                      </motion.div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No sales data available for this period
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
  );
};

export default Analytics;
