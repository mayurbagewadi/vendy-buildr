import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ArrowLeft,
  Download,
  DollarSign,
  TrendingUp,
  CreditCard,
  Users,
  Search,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Filter,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { formatDistanceToNow } from "date-fns";

interface RevenueStats {
  totalRevenue: number;
  monthlyRevenue: number;
  revenueGrowth: number;
  activeSubscriptions: number;
  pendingPayments: number;
  failedPayments: number;
}

interface SubscriptionData {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  created_at: string;
  current_period_end: string;
  trial_ends_at: string | null;
  profiles: {
    email: string;
    full_name: string | null;
  };
  subscription_plans: {
    name: string;
    monthly_price: number;
    yearly_price: number | null;
  };
}

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  total_amount: number;
  status: string;
  payment_gateway: string;
  payment_method: string;
  invoice_number: string;
  created_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
}

export default function Billing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<RevenueStats>({
    totalRevenue: 0,
    monthlyRevenue: 0,
    revenueGrowth: 0,
    activeSubscriptions: 0,
    pendingPayments: 0,
    failedPayments: 0,
  });

  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingSubscriptions, setPendingSubscriptions] = useState<SubscriptionData[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState("30");
  const [cleaningUp, setCleaningUp] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const session = sessionStorage.getItem('superadmin_session');
      if (session) {
        loadBillingData();
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Access Denied",
          description: "You need admin privileges",
          variant: "destructive"
        });
        navigate('/superadmin/login');
        return;
      }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin');

      if (!roles || roles.length === 0) {
        toast({
          title: "Access Denied",
          description: "You need admin privileges",
          variant: "destructive"
        });
        navigate('/superadmin/login');
        return;
      }

      loadBillingData();
    };

    checkAuth();
  }, [navigate]);

  const loadBillingData = async () => {
    try {
      setLoading(true);

      // Get all subscriptions with user details
      const { data: subsData, error: subsError } = await supabase
        .from('subscriptions')
        .select(`
          id,
          user_id,
          plan_id,
          status,
          billing_cycle,
          created_at,
          current_period_end,
          trial_ends_at,
          subscription_plans (
            name,
            monthly_price,
            yearly_price
          )
        `)
        .order('created_at', { ascending: false });

      if (subsError) throw subsError;

      // Get user profiles
      const userIds = [...new Set(subsData?.map(s => s.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', userIds);

      // Combine subscription data with profiles
      const enrichedSubs = subsData?.map(sub => ({
        ...sub,
        profiles: profilesData?.find(p => p.user_id === sub.user_id) || { email: '', full_name: null }
      })) || [];

      setSubscriptions(enrichedSubs);

      // Filter pending payments
      const pending = enrichedSubs.filter(s => s.status === 'pending_payment');
      setPendingSubscriptions(pending);

      // Get all transactions
      const { data: transData, error: transError } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (transError) throw transError;

      // Enrich transactions with profiles
      const transUserIds = [...new Set(transData?.map(t => t.user_id) || [])];
      const { data: transProfilesData } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', transUserIds);

      const enrichedTrans = transData?.map(trans => ({
        ...trans,
        profiles: transProfilesData?.find(p => p.user_id === trans.user_id) || { email: '', full_name: null }
      })) || [];

      setTransactions(enrichedTrans);

      // Calculate stats
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const totalRevenue = enrichedTrans
        .filter(t => t.status === 'success' || t.status === 'completed')
        .reduce((sum, t) => sum + (t.total_amount || 0), 0);

      const monthlyRevenue = enrichedTrans
        .filter(t =>
          (t.status === 'success' || t.status === 'completed') &&
          new Date(t.created_at) >= thirtyDaysAgo
        )
        .reduce((sum, t) => sum + (t.total_amount || 0), 0);

      const previousMonthRevenue = enrichedTrans
        .filter(t =>
          (t.status === 'success' || t.status === 'completed') &&
          new Date(t.created_at) >= sixtyDaysAgo &&
          new Date(t.created_at) < thirtyDaysAgo
        )
        .reduce((sum, t) => sum + (t.total_amount || 0), 0);

      const revenueGrowth = previousMonthRevenue > 0
        ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
        : 0;

      const activeSubscriptions = enrichedSubs.filter(s => s.status === 'active').length;
      const pendingPayments = pending.length;
      const failedPayments = enrichedTrans.filter(t => t.status === 'failed').length;

      setStats({
        totalRevenue,
        monthlyRevenue,
        revenueGrowth,
        activeSubscriptions,
        pendingPayments,
        failedPayments,
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

  const handleCleanupPending = async () => {
    try {
      setCleaningUp(true);

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('status', 'pending_payment')
        .lt('created_at', twentyFourHoursAgo.toISOString());

      if (error) throw error;

      toast({
        title: "Success",
        description: "Old pending payments cleaned up successfully",
      });

      loadBillingData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCleaningUp(false);
    }
  };

  const handleExportTransactions = async () => {
    try {
      const XLSX = await import('xlsx');

      const exportData = filteredTransactions.map(t => ({
        'Invoice': t.invoice_number || 'N/A',
        'User Email': t.profiles?.email || 'N/A',
        'User Name': t.profiles?.full_name || 'N/A',
        'Amount': `₹${t.total_amount}`,
        'Gateway': t.payment_gateway,
        'Method': t.payment_method || 'N/A',
        'Status': t.status,
        'Date': new Date(t.created_at).toLocaleString(),
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
      XLSX.writeFile(wb, `transactions_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({
        title: "Success",
        description: `Exported ${exportData.length} transactions`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch =
      t.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

    const daysAgo = parseInt(dateRange);
    const filterDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const matchesDate = new Date(t.created_at) >= filterDate;

    return matchesSearch && matchesStatus && matchesDate;
  });

  const filteredSubscriptions = subscriptions.filter(s => {
    const matchesSearch =
      s.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.subscription_plans?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any; label: string }> = {
      success: { variant: 'default', icon: CheckCircle, label: 'Success' },
      completed: { variant: 'default', icon: CheckCircle, label: 'Completed' },
      pending: { variant: 'secondary', icon: Clock, label: 'Pending' },
      pending_payment: { variant: 'outline', icon: AlertTriangle, label: 'Pending Payment' },
      failed: { variant: 'destructive', icon: XCircle, label: 'Failed' },
      active: { variant: 'default', icon: CheckCircle, label: 'Active' },
      trial: { variant: 'secondary', icon: Clock, label: 'Trial' },
      expired: { variant: 'destructive', icon: XCircle, label: 'Expired' },
      cancelled: { variant: 'outline', icon: XCircle, label: 'Cancelled' },
    };

    const config = statusConfig[status] || { variant: 'secondary', icon: Clock, label: status };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading billing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/superadmin/dashboard')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Billing & Revenue</h1>
                <p className="text-sm text-muted-foreground">
                  Manage subscriptions, transactions, and revenue
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="outline" onClick={loadBillingData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">All time earnings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.monthlyRevenue)}</div>
              <p className="text-xs text-muted-foreground">
                {stats.revenueGrowth >= 0 ? '+' : ''}{stats.revenueGrowth.toFixed(1)}% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{stats.pendingPayments}</div>
              <p className="text-xs text-muted-foreground">Awaiting payment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Payments</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.failedPayments}</div>
              <p className="text-xs text-muted-foreground">Unsuccessful transactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{subscriptions.length}</div>
              <p className="text-xs text-muted-foreground">All subscriptions</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Payments Alert */}
        {stats.pendingPayments > 0 && (
          <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <CardTitle className="text-orange-700 dark:text-orange-300">
                    {stats.pendingPayments} Pending Payment{stats.pendingPayments > 1 ? 's' : ''}
                  </CardTitle>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCleanupPending}
                  disabled={cleaningUp}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {cleaningUp ? 'Cleaning...' : 'Clean Old (>24h)'}
                </Button>
              </div>
              <CardDescription className="text-orange-600 dark:text-orange-400">
                These subscriptions are awaiting payment. Old pending payments (&gt;24 hours) are automatically cleaned up every hour.
              </CardDescription>
            </CardHeader>
            {pendingSubscriptions.length > 0 && (
              <CardContent>
                <div className="space-y-2">
                  {pendingSubscriptions.slice(0, 5).map(sub => (
                    <div key={sub.id} className="flex items-center justify-between p-2 bg-background rounded">
                      <div className="flex-1">
                        <p className="font-medium">{sub.profiles?.email}</p>
                        <p className="text-sm text-muted-foreground">
                          {sub.subscription_plans?.name} - {formatCurrency(
                            sub.billing_cycle === 'yearly' && sub.subscription_plans?.yearly_price 
                              ? sub.subscription_plans.yearly_price 
                              : sub.subscription_plans?.monthly_price || 0
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {pendingSubscriptions.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center">
                      +{pendingSubscriptions.length - 5} more pending
                    </p>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Tabs for Transactions and Subscriptions */}
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          </TabsList>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>View and manage all payment transactions</CardDescription>
                  </div>
                  <Button variant="outline" onClick={handleExportTransactions}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email or invoice..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Date Range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                      <SelectItem value="365">Last year</SelectItem>
                      <SelectItem value="9999">All time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Transactions Table */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Gateway</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No transactions found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTransactions.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell className="font-medium">
                              {transaction.invoice_number || 'N/A'}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{transaction.profiles?.full_name || 'N/A'}</p>
                                <p className="text-sm text-muted-foreground">
                                  {transaction.profiles?.email}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(transaction.total_amount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{transaction.payment_gateway}</Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                            <TableCell>
                              <div>
                                <p>{new Date(transaction.created_at).toLocaleDateString()}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="text-sm text-muted-foreground">
                  Showing {filteredTransactions.length} of {transactions.length} transactions
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>All Subscriptions</CardTitle>
                    <CardDescription>Manage all user subscriptions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email or plan..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="pending_payment">Pending Payment</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Subscriptions Table */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Billing Cycle</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Period End</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubscriptions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No subscriptions found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredSubscriptions.map((subscription) => (
                          <TableRow key={subscription.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{subscription.profiles?.full_name || 'N/A'}</p>
                                <p className="text-sm text-muted-foreground">
                                  {subscription.profiles?.email}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{subscription.subscription_plans?.name}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(
                                subscription.billing_cycle === 'yearly' && subscription.subscription_plans?.yearly_price
                                  ? subscription.subscription_plans.yearly_price
                                  : subscription.subscription_plans?.monthly_price || 0
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{subscription.billing_cycle}</Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                            <TableCell>
                              {subscription.current_period_end ? (
                                <div>
                                  <p>{new Date(subscription.current_period_end).toLocaleDateString()}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {formatDistanceToNow(new Date(subscription.current_period_end), { addSuffix: true })}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="text-sm text-muted-foreground">
                  Showing {filteredSubscriptions.length} of {subscriptions.length} subscriptions
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
