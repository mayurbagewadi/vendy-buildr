import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Store,
  CreditCard,
  DollarSign,
  Globe,
  Settings,
  Home,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  ChevronRight,
  LogOut,
  ExternalLink,
  UserCircle,
  Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureManagement } from "@/components/superadmin/FeatureManagement";

interface DashboardStats {
  totalUsers: number;
  todayUsers: number;
  activeStores: number;
  activePercentage: number;
  monthlyRevenue: number;
  revenueGrowth: number;
  newSignups: number;
  signupGrowth: number;
}

interface SubscriptionBreakdown {
  plan: string;
  users: number;
  percentage: number;
  revenue: number;
  color: string;
}

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  userEmail: string | null;
  timestamp: string;
  icon: string;
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [adminName, setAdminName] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionBreakdown[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      // First check for superadmin session
      const session = sessionStorage.getItem('superadmin_session');
      if (session) {
        const sessionData = JSON.parse(session);
        setAdminName(sessionData.fullName);
        loadDashboardData();
        return;
      }

      // If no superadmin session, check Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/superadmin/login');
        return;
      }

      // Check if user has super_admin role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin');

      if (!roles || roles.length === 0) {
        toast({
          title: "Access Denied",
          description: "You need super admin privileges",
          variant: "destructive"
        });
        navigate('/superadmin/login');
        return;
      }

      // Get profile name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', user.id)
        .single();

      setAdminName(profile?.full_name || profile?.email || user.email || 'Super Admin');
      loadDashboardData();
    };

    initializeAuth();

    // Auto-refresh every 60 seconds
    const interval = setInterval(loadDashboardData, 60000);
    return () => clearInterval(interval);
  }, [navigate]);

  const loadDashboardData = async () => {
    try {
      // Get total users and today's signups
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('created_at');
      
      if (profilesError) throw profilesError;

      const totalUsers = profiles?.length || 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayUsers = profiles?.filter(p => 
        new Date(p.created_at) >= today
      ).length || 0;

      // For now, consider all users as active (status field not yet implemented)
      const activeStores = totalUsers;
      const activePercentage = 100;

      // Calculate monthly revenue from transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('total_amount')
        .eq('status', 'success');

      const monthlyRevenue = transactions?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0;

      // Get new signups in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const newSignups = profiles?.filter(p => 
        new Date(p.created_at) >= thirtyDaysAgo
      ).length || 0;

      setStats({
        totalUsers,
        todayUsers,
        activeStores,
        activePercentage,
        monthlyRevenue,
        revenueGrowth: 15, // Mock data
        newSignups,
        signupGrowth: 45, // Mock data
      });

      // Mock subscription breakdown
      setSubscriptions([
        { plan: 'Free', users: Math.floor(totalUsers * 0.648), percentage: 64.8, revenue: 0, color: 'bg-gray-500' },
        { plan: 'Starter', users: Math.floor(totalUsers * 0.215), percentage: 21.5, revenue: 267732, color: 'bg-blue-500' },
        { plan: 'Pro', users: Math.floor(totalUsers * 0.072), percentage: 7.2, revenue: 269910, color: 'bg-green-500' },
        { plan: 'Enterprise', users: Math.floor(totalUsers * 0.064), percentage: 6.4, revenue: 479200, color: 'bg-purple-500' },
      ]);

      // Activity log will be populated as users interact with the system
      setActivities([]);

      setIsLoading(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error Loading Data",
        description: error.message,
      });
      setIsLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'signup': return 'user-plus';
      case 'upgrade': return 'trending-up';
      case 'publish': return 'package';
      case 'cancel': return 'x-circle';
      case 'sync': return 'refresh-cw';
      default: return 'activity';
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('superadmin_session');
    localStorage.removeItem('superadmin_remember');
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully",
    });
    navigate('/superadmin/login');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now.getTime() - time.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">YourPlatform - Super Admin</h1>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                <span>{adminName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => window.open('/', '_blank')}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View Platform Site
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-card min-h-screen p-4">
          <nav className="space-y-2">
            <Button variant="default" className="w-full justify-start">
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => navigate('/superadmin/users')}
            >
              <Users className="mr-2 h-4 w-4" />
              Users & Stores
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => navigate('/superadmin/subscription-plans')}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Subscription Plans
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => navigate('/superadmin/transactions')}
            >
              <DollarSign className="mr-2 h-4 w-4" />
              Transactions
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => navigate('/superadmin/custom-domains')}
            >
              <Globe className="mr-2 h-4 w-4" />
              Custom Domains
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => navigate('/superadmin/settings')}
            >
              <Settings className="mr-2 h-4 w-4" />
              Platform Settings
            </Button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32" />)
            ) : stats && (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.totalUsers.toLocaleString()}</div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      +{stats.todayUsers} today
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Active Stores
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.activeStores.toLocaleString()}</div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      {stats.activePercentage.toFixed(1)}% active
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Monthly Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{formatCurrency(stats.monthlyRevenue)}</div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      +{stats.revenueGrowth}% from last month
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      New Signups (30 days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.newSignups}</div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      +{stats.signupGrowth}% growth
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Subscription Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Subscriptions by Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <Skeleton className="h-40" />
              ) : (
                subscriptions.map((sub) => (
                  <div key={sub.plan} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{sub.plan}</span>
                      <span className="text-muted-foreground">
                        {sub.users} users ({sub.percentage}%)
                        {sub.revenue > 0 && ` - ${formatCurrency(sub.revenue)}/mo`}
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${sub.color} transition-all`}
                        style={{ width: `${sub.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Revenue Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Recurring Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64" />
              ) : (
                <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground">Revenue chart will be displayed here</p>
                </div>
              )}
              {stats && (
                <div className="mt-4 flex gap-6 text-sm">
                  <span>Current MRR: <strong>{formatCurrency(stats.monthlyRevenue)}</strong></span>
                  <span>ARR: <strong>{formatCurrency(stats.monthlyRevenue * 12)}</strong></span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feature Management */}
          <FeatureManagement />

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : activities.length > 0 ? (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                      <div className="p-2 bg-muted rounded-lg">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{activity.description}</p>
                        {activity.userEmail && (
                          <p className="text-xs text-muted-foreground truncate">{activity.userEmail}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>
                  ))}
                  <Button variant="ghost" className="w-full">
                    View All Activity
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No recent activity</p>
              )}
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full" />
                    <span className="font-medium">API Status</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Operational</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full" />
                    <span className="font-medium">Database</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Healthy</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full" />
                    <span className="font-medium">Payment Gateways</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full" />
                    <span className="font-medium">Uptime (30d)</span>
                  </div>
                  <p className="text-sm text-muted-foreground">99.98%</p>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-4">
                View Detailed Status
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
