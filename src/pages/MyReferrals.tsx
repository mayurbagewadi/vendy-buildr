import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import {
  UserCircle,
  LogOut,
  Shield,
  Settings,
  Search,
  TrendingUp,
  DollarSign,
  Users,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/hooks/use-toast";

export default function MyReferrals() {
  const navigate = useNavigate();
  const { toast: toastHook } = useToast();
  const [loading, setLoading] = useState(true);
  const [helper, setHelper] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [filteredReferrals, setFilteredReferrals] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stats, setStats] = useState({
    totalReferrals: 0,
    onTrial: 0,
    convertedToPaid: 0,
    conversionRate: 0,
    totalCommission: 0,
    pendingPayment: 0,
    alreadyPaid: 0
  });

  useEffect(() => {
    checkHelperAccess();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [referrals, searchTerm, statusFilter, dateFrom, dateTo]);

  const checkHelperAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: helperData, error: helperError } = await supabase
        .from("helpers")
        .select("*")
        .eq("email", user.email)
        .single();

      if (helperError || !helperData) {
        navigate("/helper/dashboard");
        return;
      }

      setHelper(helperData);
      await loadReferrals(helperData.id);
      setLoading(false);
    } catch (error) {
      console.error("Error checking helper access:", error);
      navigate("/auth");
    }
  };

  const loadReferrals = async (helperId: string) => {
    try {
      const { data: storeReferrals, error } = await supabase
        .from("store_referrals")
        .select("*")
        .eq("helper_id", helperId)
        .order("signup_date", { ascending: false });

      if (error) throw error;

      // Calculate stats
      const total = storeReferrals?.length || 0;
      const onTrial = storeReferrals?.filter(r => r.trial_status === "Active" && !r.subscription_purchased).length || 0;
      const paid = storeReferrals?.filter(r => r.subscription_purchased).length || 0;
      const conversionRate = total > 0 ? (paid / total) * 100 : 0;

      // Get commissions for these referrals
      const { data: commissions } = await supabase
        .from("network_commissions")
        .select("*")
        .eq("earning_helper_id", helperId)
        .in("store_referral_id", storeReferrals?.map(r => r.id) || []);

      const totalCommission = commissions?.reduce((sum, c) => sum + (c.direct_commission_amount || 0), 0) || 0;
      const pending = commissions?.filter(c => c.commission_status.includes("Pending")).reduce((sum, c) => sum + (c.direct_commission_amount || 0), 0) || 0;
      const alreadyPaid = commissions?.filter(c => c.commission_status === "Paid").reduce((sum, c) => sum + (c.direct_commission_amount || 0), 0) || 0;

      setStats({
        totalReferrals: total,
        onTrial,
        convertedToPaid: paid,
        conversionRate: Math.round(conversionRate),
        totalCommission,
        pendingPayment: pending,
        alreadyPaid
      });

      // Enrich referrals with commission data
      const enrichedReferrals = storeReferrals?.map(referral => {
        const commission = commissions?.find(c => c.store_referral_id === referral.id);
        return {
          ...referral,
          commissionEarned: commission?.direct_commission_amount || 0,
          commissionStatus: commission?.commission_status || "Not Earned",
          paymentDate: commission?.payment_date || null
        };
      }) || [];

      setReferrals(enrichedReferrals);
      setFilteredReferrals(enrichedReferrals);
    } catch (error) {
      console.error("Error loading referrals:", error);
      toast.error("Failed to load referrals");
    }
  };

  const applyFilters = () => {
    let filtered = [...referrals];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.store_owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.store_owner_email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter === "paid") {
      filtered = filtered.filter(r => r.subscription_purchased);
    } else if (statusFilter === "trial") {
      filtered = filtered.filter(r => !r.subscription_purchased);
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter(r => new Date(r.signup_date) >= new Date(dateFrom));
    }
    if (dateTo) {
      filtered = filtered.filter(r => new Date(r.signup_date) <= new Date(dateTo));
    }

    setFilteredReferrals(filtered);
  };

  const getTrialStatus = (referral: any) => {
    if (referral.subscription_purchased) {
      return { label: "Purchased", color: "bg-green-500", icon: CheckCircle2 };
    }

    if (referral.trial_status === "Active") {
      const daysRemaining = referral.trial_end_date
        ? differenceInDays(new Date(referral.trial_end_date), new Date())
        : 0;

      if (daysRemaining > 0) {
        return { label: `Active Trial (${daysRemaining}d left)`, color: "bg-yellow-500", icon: Clock };
      } else {
        return { label: "Trial Expired", color: "bg-red-500", icon: XCircle };
      }
    }

    return { label: "Trial Expired", color: "bg-red-500", icon: XCircle };
  };

  const getCommissionStatusBadge = (status: string) => {
    if (status === "Paid") {
      return <Badge className="bg-blue-500">Paid</Badge>;
    } else if (status.includes("Pending")) {
      return <Badge className="bg-yellow-500">Pending</Badge>;
    } else if (status.includes("Earned")) {
      return <Badge className="bg-green-500">Earned</Badge>;
    } else {
      return <Badge variant="outline">Not Earned</Badge>;
    }
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
          <p className="text-muted-foreground">Loading referrals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link to="/helper/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">My Referrals</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5" />
                  <span>{helper?.full_name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
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
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Referrals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalReferrals}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">On Trial / Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <span className="text-yellow-500">{stats.onTrial}</span>
                {" / "}
                <span className="text-green-500">{stats.convertedToPaid}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Conversion: {stats.conversionRate}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Commission</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">
                ₹{stats.totalCommission.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Payment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pending:</span>
                  <span className="font-semibold text-yellow-500">₹{stats.pendingPayment.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid:</span>
                  <span className="font-semibold text-green-500">₹{stats.alreadyPaid.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Show All</SelectItem>
                  <SelectItem value="paid">Show Only Paid</SelectItem>
                  <SelectItem value="trial">Show Only Trials</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="date"
                placeholder="From date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />

              <Input
                type="date"
                placeholder="To date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Referrals Table */}
        <Card>
          <CardHeader>
            <CardTitle>Store Referrals ({filteredReferrals.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredReferrals.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No referrals found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredReferrals.map((referral) => {
                  const trialStatus = getTrialStatus(referral);
                  const StatusIcon = trialStatus.icon;

                  return (
                    <Card key={referral.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                          {/* Store Owner Info */}
                          <div>
                            <div className="font-semibold">{referral.store_owner_name}</div>
                            <div className="text-sm text-muted-foreground">{referral.store_owner_email}</div>
                            <div className="text-sm text-muted-foreground">{referral.store_owner_phone}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              <Calendar className="inline w-3 h-3 mr-1" />
                              Signed up: {format(new Date(referral.signup_date), "PPP")}
                            </div>
                          </div>

                          {/* Trial/Subscription Status */}
                          <div>
                            <div className="text-sm font-semibold mb-2">Status</div>
                            <Badge className={`${trialStatus.color} flex items-center gap-1 w-fit`}>
                              <StatusIcon className="w-3 h-3" />
                              {trialStatus.label}
                            </Badge>
                            {referral.subscription_purchased && (
                              <div className="mt-2 text-sm">
                                <div className="text-muted-foreground">Plan: {referral.subscription_plan}</div>
                                <div className="text-muted-foreground">Amount: ₹{referral.subscription_amount?.toLocaleString()}</div>
                                {referral.purchase_date && (
                                  <div className="text-xs text-muted-foreground">
                                    Purchased: {format(new Date(referral.purchase_date), "PP")}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Commission Info */}
                          <div>
                            <div className="text-sm font-semibold mb-2">Commission</div>
                            <div className="text-2xl font-bold text-green-500">
                              ₹{referral.commissionEarned.toLocaleString()}
                            </div>
                            <div className="mt-2">
                              {getCommissionStatusBadge(referral.commissionStatus)}
                            </div>
                          </div>

                          {/* Payment Info */}
                          <div>
                            <div className="text-sm font-semibold mb-2">Payment</div>
                            {referral.paymentDate ? (
                              <div className="text-sm">
                                <div className="text-muted-foreground">Paid on:</div>
                                <div className="font-medium">{format(new Date(referral.paymentDate), "PPP")}</div>
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">Not paid yet</div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
