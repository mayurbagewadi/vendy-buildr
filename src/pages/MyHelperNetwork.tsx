import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import { format } from "date-fns";
import {
  UserCircle,
  LogOut,
  Shield,
  Settings,
  ArrowLeft,
  Users,
  TrendingUp,
  DollarSign,
  Network,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  Award,
  Link2,
  Copy,
  ExternalLink
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/hooks/use-toast";

interface RecruitedHelper {
  id: string;
  full_name: string;
  referral_code: string;
  status: string;
  created_at: string;
  email: string;
  phone: string;
  store_referrals_count: number;
  total_commission_earned: number;
  network_commission_to_recruiter: number;
  commission_status: string;
  application_status?: string;
}

export default function MyHelperNetwork() {
  const navigate = useNavigate();
  const { toast: toastHook } = useToast();
  const [loading, setLoading] = useState(true);
  const [helper, setHelper] = useState<any>(null);
  const [recruitedHelpers, setRecruitedHelpers] = useState<RecruitedHelper[]>([]);
  const [stats, setStats] = useState({
    totalRecruited: 0,
    pendingApproval: 0,
    active: 0,
    suspended: 0,
    totalNetworkCommission: 0,
    pendingCommission: 0,
    paidCommission: 0,
    bestPerformer: { name: "", earned: 0 }
  });

  useEffect(() => {
    checkHelperAccess();
  }, []);

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
      await loadRecruitedHelpers(helperData.id);
      setLoading(false);
    } catch (error) {
      console.error("Error checking helper access:", error);
      navigate("/auth");
    }
  };

  const loadRecruitedHelpers = async (helperId: string) => {
    try {
      // Get all helpers recruited by this helper
      const { data: recruited, error: recruitedError } = await supabase
        .from("helpers")
        .select(`
          *,
          helper_applications!inner(application_status)
        `)
        .eq("recruited_by_helper_id", helperId)
        .order("created_at", { ascending: false });

      if (recruitedError) throw recruitedError;

      // For each recruited helper, get their performance
      const enrichedHelpers = await Promise.all(
        (recruited || []).map(async (recruitedHelper) => {
          // Get store referrals count
          const { data: storeReferrals } = await supabase
            .from("store_referrals")
            .select("id")
            .eq("helper_id", recruitedHelper.id);

          // Get their total commission earned
          const { data: theirCommissions } = await supabase
            .from("network_commissions")
            .select("direct_commission_amount, commission_status")
            .eq("earning_helper_id", recruitedHelper.id);

          const totalCommissionEarned = theirCommissions?.reduce(
            (sum, c) => sum + (c.direct_commission_amount || 0),
            0
          ) || 0;

          // Get network commission earned by recruiter from this helper
          const { data: networkCommissions } = await supabase
            .from("network_commissions")
            .select("network_commission_amount, commission_status")
            .eq("earning_helper_id", recruitedHelper.id)
            .eq("recruiting_helper_id", helperId);

          const networkCommissionToRecruiter = networkCommissions?.reduce(
            (sum, c) => sum + (c.network_commission_amount || 0),
            0
          ) || 0;

          // Determine commission status
          let commissionStatus = "Not Earned";
          if (networkCommissions && networkCommissions.length > 0) {
            const hasPending = networkCommissions.some(c => c.commission_status.includes("Pending"));
            const allPaid = networkCommissions.every(c => c.commission_status === "Paid");

            if (allPaid) {
              commissionStatus = "Paid";
            } else if (hasPending) {
              commissionStatus = "Pending";
            } else {
              commissionStatus = "Earned";
            }
          }

          return {
            ...recruitedHelper,
            store_referrals_count: storeReferrals?.length || 0,
            total_commission_earned: totalCommissionEarned,
            network_commission_to_recruiter: networkCommissionToRecruiter,
            commission_status: commissionStatus,
            application_status: recruitedHelper.helper_applications?.application_status || "Pending"
          };
        })
      );

      setRecruitedHelpers(enrichedHelpers);

      // Calculate stats
      const total = enrichedHelpers.length;
      const pending = enrichedHelpers.filter(h => h.application_status === "Pending").length;
      const active = enrichedHelpers.filter(h => h.status === "Active").length;
      const suspended = enrichedHelpers.filter(h => h.status === "Suspended").length;

      const totalNetwork = enrichedHelpers.reduce((sum, h) => sum + h.network_commission_to_recruiter, 0);
      const pendingComm = enrichedHelpers
        .filter(h => h.commission_status === "Pending")
        .reduce((sum, h) => sum + h.network_commission_to_recruiter, 0);
      const paidComm = enrichedHelpers
        .filter(h => h.commission_status === "Paid")
        .reduce((sum, h) => sum + h.network_commission_to_recruiter, 0);

      // Find best performer
      const bestPerformer = enrichedHelpers.reduce(
        (best, helper) => {
          if (helper.network_commission_to_recruiter > best.earned) {
            return { name: helper.full_name, earned: helper.network_commission_to_recruiter };
          }
          return best;
        },
        { name: "", earned: 0 }
      );

      setStats({
        totalRecruited: total,
        pendingApproval: pending,
        active,
        suspended,
        totalNetworkCommission: totalNetwork,
        pendingCommission: pendingComm,
        paidCommission: paidComm,
        bestPerformer
      });
    } catch (error) {
      console.error("Error loading recruited helpers:", error);
      toast.error("Failed to load network data");
    }
  };

  const getStatusBadge = (status: string, applicationStatus: string) => {
    if (applicationStatus === "Pending") {
      return (
        <Badge className="bg-yellow-500">
          <Clock className="w-3 h-3 mr-1" />
          Pending Approval
        </Badge>
      );
    }

    if (status === "Active") {
      return (
        <Badge className="bg-green-500">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    }

    if (status === "Suspended") {
      return (
        <Badge className="bg-red-500">
          <XCircle className="w-3 h-3 mr-1" />
          Suspended
        </Badge>
      );
    }

    return <Badge variant="outline">Unknown</Badge>;
  };

  const getCommissionStatusBadge = (status: string) => {
    if (status === "Paid") {
      return <Badge className="bg-blue-500">Paid</Badge>;
    } else if (status === "Pending") {
      return <Badge className="bg-yellow-500">Pending</Badge>;
    } else if (status === "Earned") {
      return <Badge className="bg-green-500">Earned</Badge>;
    } else {
      return <Badge variant="outline">Not Earned</Badge>;
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
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
          <p className="text-muted-foreground">Loading network...</p>
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
              <Network className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">My Helper Network</h1>
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
        {/* Network Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Network Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalRecruited}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Pending: {stats.pendingApproval} | Active: {stats.active}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Network Commission</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">
                ₹{stats.totalNetworkCommission.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                From {stats.active} active helpers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Commission Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pending:</span>
                  <span className="font-semibold text-yellow-500">₹{stats.pendingCommission.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid:</span>
                  <span className="font-semibold text-green-500">₹{stats.paidCommission.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Best Performer</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.bestPerformer.name ? (
                <>
                  <div className="font-semibold text-lg truncate">{stats.bestPerformer.name}</div>
                  <p className="text-sm text-green-500">
                    Earned you ₹{stats.bestPerformer.earned.toLocaleString()}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recruited Helpers */}
        {recruitedHelpers.length === 0 ? (
          // Empty State
          <Card>
            <CardContent className="py-16">
              <div className="text-center max-w-2xl mx-auto">
                <Network className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
                <h3 className="text-2xl font-bold mb-4">Build Your Helper Network</h3>
                <p className="text-muted-foreground mb-6 text-lg">
                  You haven't recruited any helpers yet. Start building your network to earn 5% network commission on their earnings!
                </p>

                {/* Benefits */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <DollarSign className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <h4 className="font-semibold mb-1">Passive Income</h4>
                    <p className="text-sm text-muted-foreground">
                      Earn 5% of everything your recruited helpers earn
                    </p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <TrendingUp className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <h4 className="font-semibold mb-1">Unlimited Potential</h4>
                    <p className="text-sm text-muted-foreground">
                      No limit on how many helpers you can recruit
                    </p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <Award className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                    <h4 className="font-semibold mb-1">Build Your Team</h4>
                    <p className="text-sm text-muted-foreground">
                      Create a strong network and grow together
                    </p>
                  </div>
                </div>

                {/* Recruitment Link */}
                <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-6">
                  <h4 className="font-semibold text-lg mb-3 flex items-center justify-center gap-2">
                    <Link2 className="h-5 w-5" />
                    Your Helper Recruitment Link
                  </h4>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={`${window.location.origin}/become-helper?ref=${helper?.referral_code}`}
                      readOnly
                      className="flex-1 px-4 py-2 bg-background border rounded-lg text-sm"
                    />
                    <Button
                      onClick={() =>
                        copyToClipboard(
                          `${window.location.origin}/become-helper?ref=${helper?.referral_code}`,
                          "Helper recruitment link"
                        )
                      }
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Share this link with people interested in becoming helpers
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Visual Hierarchy Header */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <UserCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">
                      You ({helper?.full_name} - {helper?.helper_id})
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Network Builder | {recruitedHelpers.length} Helper{recruitedHelpers.length !== 1 ? "s" : ""} Recruited
                    </p>
                  </div>
                </div>

                {/* Recruitment Link */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={`${window.location.origin}/become-helper?ref=${helper?.referral_code}`}
                    readOnly
                    className="flex-1 px-3 py-2 bg-background border rounded-lg text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      copyToClipboard(
                        `${window.location.origin}/become-helper?ref=${helper?.referral_code}`,
                        "Helper recruitment link"
                      )
                    }
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recruited Helpers List */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Your Recruited Helpers ({recruitedHelpers.length})</h3>

              {recruitedHelpers.map((recruitedHelper, index) => (
                <Card key={recruitedHelper.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Tree Line Visual */}
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        {index < recruitedHelpers.length - 1 && (
                          <div className="w-0.5 h-full bg-primary/20 mt-2"></div>
                        )}
                      </div>

                      {/* Helper Details */}
                      <div className="flex-1 min-w-0">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                          {/* Basic Info */}
                          <div>
                            <div className="font-semibold text-lg">{recruitedHelper.full_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {recruitedHelper.id} | {recruitedHelper.referral_code}
                            </div>
                            <div className="text-sm text-muted-foreground">{recruitedHelper.email}</div>
                            <div className="text-xs text-muted-foreground mt-2">
                              <Calendar className="inline w-3 h-3 mr-1" />
                              Joined: {format(new Date(recruitedHelper.created_at), "PPP")}
                            </div>
                            <div className="mt-2">
                              {getStatusBadge(recruitedHelper.status, recruitedHelper.application_status!)}
                            </div>
                          </div>

                          {/* Performance */}
                          <div>
                            <div className="text-sm font-semibold mb-2">Their Performance</div>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2">
                                <Shield className="w-3 h-3 text-muted-foreground" />
                                <span className="text-muted-foreground">Store Referrals:</span>
                                <span className="font-semibold">{recruitedHelper.store_referrals_count}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-3 h-3 text-muted-foreground" />
                                <span className="text-muted-foreground">Their Earnings:</span>
                                <span className="font-semibold text-green-500">
                                  ₹{recruitedHelper.total_commission_earned.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Network Commission */}
                          <div>
                            <div className="text-sm font-semibold mb-2">Your Network Commission</div>
                            <div className="text-2xl font-bold text-green-500 mb-2">
                              ₹{recruitedHelper.network_commission_to_recruiter.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground mb-2">
                              5% of their ₹{recruitedHelper.total_commission_earned.toLocaleString()}
                            </div>
                            {getCommissionStatusBadge(recruitedHelper.commission_status)}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center">
                            <Button variant="outline" size="sm" className="w-full">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
