import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users,
  Globe,
  DollarSign,
  Link as LinkIcon,
  Copy,
  QrCode,
  UserCircle,
  LogOut,
  Shield,
  TrendingUp,
  Settings,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/hooks/use-toast";

export default function HelperDashboard() {
  const navigate = useNavigate();
  const { toast: toastHook } = useToast();
  const [loading, setLoading] = useState(true);
  const [helper, setHelper] = useState<any>(null);
  const [stats, setStats] = useState<any>({
    directReferrals: { total: 0, trial: 0, paid: 0, conversionRate: 0 },
    helperNetwork: { total: 0, pending: 0, approved: 0, suspended: 0 },
    directCommission: { total: 0, pending: 0, paid: 0 },
    networkCommission: { total: 0, pending: 0, paid: 0 },
  });

  useEffect(() => {
    checkHelperAccess();
  }, []);

  const checkHelperAccess = async () => {
    try {
      // Check Supabase authentication
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth");
        return;
      }

      // Get helper record by email
      const { data: helperData, error: helperError } = await supabase
        .from("helpers")
        .select("*")
        .eq("email", user.email)
        .single();

      if (helperError || !helperData) {
        // No helper record found - check if application exists
        const { data: appData } = await supabase
          .from("helper_applications")
          .select("*")
          .eq("email", user.email)
          .single();

        if (appData) {
          if (appData.application_status === "Pending") {
            navigate("/application-status");
            return;
          } else if (appData.application_status === "Rejected") {
            toastHook({
              title: "Application Rejected",
              description: appData.rejection_reason || "Your application was not approved",
              variant: "destructive"
            });
            navigate("/application-status");
            return;
          }
        } else {
          // No application found
          navigate("/become-helper");
          return;
        }
      }

      // Check if helper is suspended
      if (helperData.status === "Suspended") {
        toastHook({
          title: "Account Suspended",
          description: "Your helper account has been suspended. Please contact support.",
          variant: "destructive"
        });
        return;
      }

      setHelper(helperData);
      await loadStats(helperData.id);
      setLoading(false);
    } catch (error) {
      console.error("Error checking helper access:", error);
      navigate("/auth");
    }
  };

  const loadStats = async (helperId: string) => {
    try {
      // Load direct referrals (store owners)
      const { data: storeReferrals } = await supabase
        .from("store_referrals")
        .select("*")
        .eq("helper_id", helperId);

      const totalStores = storeReferrals?.length || 0;
      const trialStores = storeReferrals?.filter(s => !s.subscription_purchased).length || 0;
      const paidStores = storeReferrals?.filter(s => s.subscription_purchased).length || 0;
      const conversionRate = totalStores > 0 ? (paidStores / totalStores) * 100 : 0;

      // Load helper network (helpers recruited)
      const { data: recruitedHelpers } = await supabase
        .from("helpers")
        .select("*, helper_applications!inner(*)")
        .eq("recruited_by_helper_id", helperId);

      const totalHelpers = recruitedHelpers?.length || 0;

      // Get pending applications for recruited helpers
      const { data: pendingApps } = await supabase
        .from("helper_applications")
        .select("*")
        .eq("recruited_by_helper_id", helperId)
        .eq("application_status", "Pending");

      const approvedHelpers = recruitedHelpers?.filter(h => h.status === "Active").length || 0;
      const suspendedHelpers = recruitedHelpers?.filter(h => h.status === "Suspended").length || 0;

      // Load commissions
      const { data: commissions } = await supabase
        .from("network_commissions")
        .select("*")
        .eq("earning_helper_id", helperId);

      const directCommissionTotal = commissions?.reduce((sum, c) => sum + (c.direct_commission_amount || 0), 0) || 0;
      const networkCommissionTotal = commissions?.reduce((sum, c) => sum + (c.network_commission_amount || 0), 0) || 0;

      const directPending = commissions?.filter(c => c.commission_status.includes("Pending")).reduce((sum, c) => sum + (c.direct_commission_amount || 0), 0) || 0;
      const directPaid = commissions?.filter(c => c.commission_status === "Paid").reduce((sum, c) => sum + (c.direct_commission_amount || 0), 0) || 0;

      const networkPending = commissions?.filter(c => c.commission_status.includes("Pending")).reduce((sum, c) => sum + (c.network_commission_amount || 0), 0) || 0;
      const networkPaid = commissions?.filter(c => c.commission_status === "Paid").reduce((sum, c) => sum + (c.network_commission_amount || 0), 0) || 0;

      setStats({
        directReferrals: {
          total: totalStores,
          trial: trialStores,
          paid: paidStores,
          conversionRate: Math.round(conversionRate)
        },
        helperNetwork: {
          total: totalHelpers,
          pending: pendingApps?.length || 0,
          approved: approvedHelpers,
          suspended: suspendedHelpers
        },
        directCommission: {
          total: directCommissionTotal,
          pending: directPending,
          paid: directPaid
        },
        networkCommission: {
          total: networkCommissionTotal,
          pending: networkPending,
          paid: networkPaid
        }
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const handleCopyLink = (link: string, type: string) => {
    navigator.clipboard.writeText(link);
    toast.success(`${type} link copied to clipboard!`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toastHook({
      title: "Logged Out",
      description: "You have been logged out successfully",
    });
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!helper) {
    return null;
  }

  const storeReferralLink = `${window.location.origin}/auth?ref=${helper.referral_code}`;
  const helperRecruitmentLink = `${window.location.origin}/become-helper?ref=${helper.referral_code}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Helper Dashboard</h1>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5" />
                  <span>{helper.full_name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate("/helper/profile")}>
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
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6 space-y-6">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold">Welcome back, {helper.full_name}!</h2>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="outline" className="font-mono">
                ID: {helper.referral_code}
              </Badge>
              <Badge className={helper.status === "Active" ? "bg-green-500" : "bg-yellow-500"}>
                {helper.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Direct Referrals */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Direct Referrals
              </CardTitle>
              <Users className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-500 mb-2">
                {stats.directReferrals.total}
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>{stats.directReferrals.trial} on trial</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>{stats.directReferrals.paid} paid customers</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3 w-3" />
                  <span>Conversion: {stats.directReferrals.conversionRate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Helper Network */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Helper Network
              </CardTitle>
              <Globe className="h-5 w-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-500 mb-2">
                {stats.helperNetwork.total}
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>{stats.helperNetwork.pending} pending approval</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>{stats.helperNetwork.approved} approved & active</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-3 w-3 text-red-500" />
                  <span>{stats.helperNetwork.suspended} suspended</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Direct Commission */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Direct Commission
              </CardTitle>
              <DollarSign className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500 mb-2">
                ₹{stats.directCommission.total.toLocaleString()}
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>₹{stats.directCommission.pending.toLocaleString()} pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>₹{stats.directCommission.paid.toLocaleString()} paid</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Network Commission */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Network Commission
              </CardTitle>
              <LinkIcon className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500 mb-2">
                ₹{stats.networkCommission.total.toLocaleString()}
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>₹{stats.networkCommission.pending.toLocaleString()} pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>₹{stats.networkCommission.paid.toLocaleString()} paid</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/helper/my-referrals")}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">My Store Referrals</h3>
                  <p className="text-sm text-muted-foreground">
                    View all {stats.directReferrals.total} store owners you've referred
                  </p>
                </div>
                <ArrowRight className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/helper/my-helper-network")}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">My Helper Network</h3>
                  <p className="text-sm text-muted-foreground">
                    View all {stats.helperNetwork.total} helpers you've recruited
                  </p>
                </div>
                <ArrowRight className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/helper/commission-history")}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Commission History</h3>
                  <p className="text-sm text-muted-foreground">
                    View earnings & payment details
                  </p>
                </div>
                <ArrowRight className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Your Referral Links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Store Owner Referral Link */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Store Owner Referral Link</h3>
                  <p className="text-sm text-muted-foreground">Share this to refer store owners</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {}}
                  className="gap-2"
                >
                  <QrCode className="h-4 w-4" />
                  QR Code
                </Button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm truncate">
                  {storeReferralLink}
                </div>
                <Button
                  onClick={() => handleCopyLink(storeReferralLink, "Store referral")}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
            </div>

            {/* Helper Recruitment Link */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Helper Recruitment Link</h3>
                  <p className="text-sm text-muted-foreground">Share this to recruit helpers</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {}}
                  className="gap-2"
                >
                  <QrCode className="h-4 w-4" />
                  QR Code
                </Button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm truncate">
                  {helperRecruitmentLink}
                </div>
                <Button
                  onClick={() => handleCopyLink(helperRecruitmentLink, "Helper recruitment")}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
