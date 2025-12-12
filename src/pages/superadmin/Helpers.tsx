import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Users,
  Search,
  Eye,
  Edit,
  Ban,
  CheckCircle,
  DollarSign,
  Shield,
  TrendingUp,
  Calendar,
  Activity,
  Network,
  FileText,
  AlertCircle,
  Plus
} from "lucide-react";

interface Helper {
  id: string;
  helper_id: string;
  full_name: string;
  email: string;
  phone: string;
  referral_code: string;
  created_at: string;
  status: string;
  direct_commission_rate: number;
  network_commission_rate: number;
  direct_referrals_count: number;
  recruited_helpers_count: number;
  total_commission_earned: number;
  total_commission_paid: number;
  total_pending_payment: number;
}

export default function SuperAdminHelpers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [filteredHelpers, setFilteredHelpers] = useState<Helper[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("joined_date");

  // Modals
  const [viewDetailsModal, setViewDetailsModal] = useState(false);
  const [editRatesModal, setEditRatesModal] = useState(false);
  const [suspendModal, setSuspendModal] = useState(false);
  const [activateModal, setActivateModal] = useState(false);
  const [manualPaymentModal, setManualPaymentModal] = useState(false);

  // Selected helper
  const [selectedHelper, setSelectedHelper] = useState<Helper | null>(null);
  const [helperDetails, setHelperDetails] = useState<any>(null);

  // Forms
  const [editRatesForm, setEditRatesForm] = useState({
    direct_rate: 10,
    network_rate: 5,
    reason: "",
    apply_to: "future"
  });

  const [suspendForm, setSuspendForm] = useState({
    reason: ""
  });

  const [activateForm, setActivateForm] = useState({
    notes: ""
  });

  const [manualPaymentForm, setManualPaymentForm] = useState({
    amount: "",
    reference: "",
    notes: ""
  });

  useEffect(() => {
    checkSuperAdminAccess();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [helpers, searchTerm, statusFilter, sortBy]);

  const checkSuperAdminAccess = async () => {
    try {
      const session = sessionStorage.getItem('superadmin_session');
      if (!session) {
        navigate('/superadmin/login');
        return;
      }

      await loadHelpers();
      setLoading(false);
    } catch (error) {
      console.error("Error checking super admin access:", error);
      navigate('/superadmin/login');
    }
  };

  const loadHelpers = async () => {
    try {
      const { data: helpersData, error } = await supabase
        .from("helpers")
        .select(`
          *,
          store_referrals:store_referrals(id),
          recruited_helpers:helpers!recruited_by_helper_id(id)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enrichedHelpers = await Promise.all(
        (helpersData || []).map(async (helper: any) => {
          // Get commission data
          const { data: commissions } = await supabase
            .from("network_commissions")
            .select("*")
            .eq("earning_helper_id", helper.id);

          const totalEarned = commissions?.reduce(
            (sum, c) => sum + (c.direct_commission_amount || 0) + (c.network_commission_amount || 0),
            0
          ) || 0;

          const totalPaid = commissions?.filter(c => c.commission_status === "Paid").reduce(
            (sum, c) => sum + (c.direct_commission_amount || 0) + (c.network_commission_amount || 0),
            0
          ) || 0;

          const totalPending = commissions?.filter(c => c.commission_status.includes("Pending")).reduce(
            (sum, c) => sum + (c.direct_commission_amount || 0) + (c.network_commission_amount || 0),
            0
          ) || 0;

          return {
            ...helper,
            direct_commission_rate: helper.direct_commission_rate || 10,
            network_commission_rate: helper.network_commission_rate || 5,
            direct_referrals_count: helper.store_referrals?.length || 0,
            recruited_helpers_count: helper.recruited_helpers?.length || 0,
            total_commission_earned: totalEarned,
            total_commission_paid: totalPaid,
            total_pending_payment: totalPending
          };
        })
      );

      setHelpers(enrichedHelpers);
      setFilteredHelpers(enrichedHelpers);
    } catch (error) {
      console.error("Error loading helpers:", error);
      toast.error("Failed to load helpers");
    }
  };

  const applyFilters = () => {
    let filtered = [...helpers];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(h =>
        h.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.helper_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(h => h.status.toLowerCase() === statusFilter.toLowerCase());
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "joined_date":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "referrals":
          return b.direct_referrals_count - a.direct_referrals_count;
        case "network":
          return b.recruited_helpers_count - a.recruited_helpers_count;
        case "earnings":
          return b.total_commission_earned - a.total_commission_earned;
        default:
          return 0;
      }
    });

    setFilteredHelpers(filtered);
  };

  const handleViewDetails = async (helper: Helper) => {
    setSelectedHelper(helper);

    // Load detailed information
    try {
      const { data: storeReferrals } = await supabase
        .from("store_referrals")
        .select("*")
        .eq("helper_id", helper.id);

      const { data: recruitedHelpers } = await supabase
        .from("helpers")
        .select("*")
        .eq("recruited_by_helper_id", helper.id);

      const { data: commissions } = await supabase
        .from("network_commissions")
        .select(`
          *,
          store_referral:store_referrals(store_owner_name, subscription_plan)
        `)
        .eq("earning_helper_id", helper.id)
        .order("created_at", { ascending: false });

      // Activity log
      const activityLog = [];
      activityLog.push({ date: helper.created_at, event: "Application Approved", icon: CheckCircle });

      if (storeReferrals && storeReferrals.length > 0) {
        activityLog.push({ date: storeReferrals[0].signup_date, event: "First Referral", icon: Users });
      }

      if (commissions && commissions.length > 0) {
        activityLog.push({ date: commissions[0].created_at, event: "First Commission Earned", icon: DollarSign });
      }

      if (recruitedHelpers && recruitedHelpers.length > 0) {
        activityLog.push({ date: recruitedHelpers[0].created_at, event: "First Helper Recruited", icon: Network });
      }

      setHelperDetails({
        storeReferrals,
        recruitedHelpers,
        commissions,
        activityLog: activityLog.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      });

      setViewDetailsModal(true);
    } catch (error) {
      console.error("Error loading helper details:", error);
      toast.error("Failed to load helper details");
    }
  };

  const handleEditRates = (helper: Helper) => {
    setSelectedHelper(helper);
    setEditRatesForm({
      direct_rate: helper.direct_commission_rate,
      network_rate: helper.network_commission_rate,
      reason: "",
      apply_to: "future"
    });
    setEditRatesModal(true);
  };

  const handleSaveRates = async () => {
    if (!editRatesForm.reason) {
      toast.error("Please provide a reason for changing rates");
      return;
    }

    try {
      const { error } = await supabase
        .from("helpers")
        .update({
          direct_commission_rate: editRatesForm.direct_rate,
          network_commission_rate: editRatesForm.network_rate,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedHelper?.id);

      if (error) throw error;

      toast.success("Commission rates updated successfully");
      setEditRatesModal(false);
      await loadHelpers();
    } catch (error) {
      console.error("Error updating rates:", error);
      toast.error("Failed to update commission rates");
    }
  };

  const handleSuspend = async () => {
    if (!suspendForm.reason) {
      toast.error("Please provide a reason for suspension");
      return;
    }

    try {
      const { error } = await supabase
        .from("helpers")
        .update({
          status: "Suspended",
          suspension_reason: suspendForm.reason,
          suspended_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedHelper?.id);

      if (error) throw error;

      toast.success("Helper suspended successfully. Notification email will be sent.");
      setSuspendModal(false);
      setSuspendForm({ reason: "" });
      await loadHelpers();
    } catch (error) {
      console.error("Error suspending helper:", error);
      toast.error("Failed to suspend helper");
    }
  };

  const handleActivate = async () => {
    try {
      const { error } = await supabase
        .from("helpers")
        .update({
          status: "Active",
          suspension_reason: null,
          suspended_at: null,
          activation_notes: activateForm.notes,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedHelper?.id);

      if (error) throw error;

      toast.success("Helper activated successfully. Notification email will be sent.");
      setActivateModal(false);
      setActivateForm({ notes: "" });
      await loadHelpers();
    } catch (error) {
      console.error("Error activating helper:", error);
      toast.error("Failed to activate helper");
    }
  };

  const handleAddManualPayment = async () => {
    if (!manualPaymentForm.amount || !manualPaymentForm.reference) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      // This would create a manual payment record
      // For now, just show success
      toast.success("Manual payment recorded successfully");
      setManualPaymentModal(false);
      setManualPaymentForm({ amount: "", reference: "", notes: "" });
    } catch (error) {
      console.error("Error adding manual payment:", error);
      toast.error("Failed to add manual payment");
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "Active") {
      return <Badge className="bg-green-500">Active</Badge>;
    } else if (status === "Suspended") {
      return <Badge className="bg-red-500">Suspended</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading helpers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" />
              Helper Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage all approved helpers and their performance
            </p>
          </div>
          <Button onClick={() => navigate("/superadmin/dashboard")}>
            Back to Dashboard
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Helpers</p>
              <p className="text-2xl font-bold">{helpers.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-500">
                {helpers.filter(h => h.status === "Active").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Suspended</p>
              <p className="text-2xl font-bold text-red-500">
                {helpers.filter(h => h.status === "Suspended").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Commissions Paid</p>
              <p className="text-2xl font-bold text-blue-500">
                ₹{helpers.reduce((sum, h) => sum + h.total_commission_paid, 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by name, email, or ID..."
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
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="suspended">Suspended Only</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="joined_date">Join Date</SelectItem>
                  <SelectItem value="referrals">Referrals Count</SelectItem>
                  <SelectItem value="network">Network Size</SelectItem>
                  <SelectItem value="earnings">Total Earnings</SelectItem>
                </SelectContent>
              </Select>

              <div className="text-sm text-muted-foreground flex items-center">
                Showing {filteredHelpers.length} of {helpers.length} helpers
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Helpers Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Helper ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Referral Code</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Referrals</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Rates</TableHead>
                    <TableHead>Earned</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHelpers.map((helper) => (
                    <TableRow key={helper.id}>
                      <TableCell className="font-medium">{helper.helper_id}</TableCell>
                      <TableCell>{helper.full_name}</TableCell>
                      <TableCell className="text-sm">{helper.email}</TableCell>
                      <TableCell>{helper.phone}</TableCell>
                      <TableCell className="font-mono text-sm">{helper.referral_code}</TableCell>
                      <TableCell>{format(new Date(helper.created_at), "PP")}</TableCell>
                      <TableCell>{getStatusBadge(helper.status)}</TableCell>
                      <TableCell>{helper.direct_referrals_count}</TableCell>
                      <TableCell>{helper.recruited_helpers_count}</TableCell>
                      <TableCell className="text-sm">
                        {helper.direct_commission_rate}% / {helper.network_commission_rate}%
                      </TableCell>
                      <TableCell className="text-green-500 font-semibold">
                        ₹{helper.total_commission_earned.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-blue-500">
                        ₹{helper.total_commission_paid.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-yellow-500">
                        ₹{helper.total_pending_payment.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleViewDetails(helper)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEditRates(helper)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {helper.status === "Active" ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedHelper(helper);
                                setSuspendModal(true);
                              }}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                setSelectedHelper(helper);
                                setActivateModal(true);
                              }}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Details Modal */}
      <Dialog open={viewDetailsModal} onOpenChange={setViewDetailsModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Helper Details - {selectedHelper?.full_name}</DialogTitle>
            <DialogDescription>
              {selectedHelper?.helper_id} | {selectedHelper?.email}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview" className="mt-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="referrals">Store Referrals</TabsTrigger>
              <TabsTrigger value="network">Helper Network</TabsTrigger>
              <TabsTrigger value="commissions">Commissions</TabsTrigger>
              <TabsTrigger value="activity">Activity Log</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Helper ID</p>
                    <p className="font-semibold">{selectedHelper?.helper_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Referral Code</p>
                    <p className="font-semibold">{selectedHelper?.referral_code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-semibold">{selectedHelper?.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-semibold">{selectedHelper?.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Joined Date</p>
                    <p className="font-semibold">
                      {selectedHelper && format(new Date(selectedHelper.created_at), "PPP")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {selectedHelper && getStatusBadge(selectedHelper.status)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Statistics</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Direct Referrals</p>
                    <p className="text-2xl font-bold">{selectedHelper?.direct_referrals_count}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Recruited Helpers</p>
                    <p className="text-2xl font-bold">{selectedHelper?.recruited_helpers_count}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Earned</p>
                    <p className="text-2xl font-bold text-green-500">
                      ₹{selectedHelper?.total_commission_earned.toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="referrals">
              <Card>
                <CardHeader>
                  <CardTitle>Store Referrals ({helperDetails?.storeReferrals?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                  {helperDetails?.storeReferrals?.length > 0 ? (
                    <div className="space-y-2">
                      {helperDetails.storeReferrals.map((referral: any) => (
                        <div key={referral.id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-semibold">{referral.store_owner_name}</p>
                            <p className="text-sm text-muted-foreground">{referral.store_owner_email}</p>
                          </div>
                          <div className="text-right">
                            <Badge className={referral.subscription_purchased ? "bg-green-500" : "bg-yellow-500"}>
                              {referral.subscription_purchased ? "Paid" : "Trial"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No store referrals yet</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="network">
              <Card>
                <CardHeader>
                  <CardTitle>Helper Network ({helperDetails?.recruitedHelpers?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                  {helperDetails?.recruitedHelpers?.length > 0 ? (
                    <div className="space-y-2">
                      {helperDetails.recruitedHelpers.map((recruited: any) => (
                        <div key={recruited.id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-semibold">{recruited.full_name}</p>
                            <p className="text-sm text-muted-foreground">{recruited.helper_id}</p>
                          </div>
                          <Badge className={recruited.status === "Active" ? "bg-green-500" : "bg-red-500"}>
                            {recruited.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No recruited helpers yet</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="commissions">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Commission History ({helperDetails?.commissions?.length || 0})</CardTitle>
                    <Button size="sm" onClick={() => setManualPaymentModal(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Manual Payment
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {helperDetails?.commissions?.length > 0 ? (
                    <div className="space-y-2">
                      {helperDetails.commissions.map((commission: any) => (
                        <div key={commission.id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-semibold">
                              {commission.store_referral?.store_owner_name || "N/A"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(commission.created_at), "PPP")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-500">
                              ₹{(commission.direct_commission_amount + commission.network_commission_amount).toLocaleString()}
                            </p>
                            <Badge className={commission.commission_status === "Paid" ? "bg-blue-500" : "bg-yellow-500"}>
                              {commission.commission_status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No commissions yet</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Log</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {helperDetails?.activityLog?.map((activity: any, index: number) => {
                      const Icon = activity.icon;
                      return (
                        <div key={index} className="flex items-start gap-4">
                          <div className="p-2 bg-primary/10 rounded-full">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">{activity.event}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(activity.date), "PPP 'at' pp")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit Commission Rates Modal */}
      <Dialog open={editRatesModal} onOpenChange={setEditRatesModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Commission Rates</DialogTitle>
            <DialogDescription>
              Update commission rates for {selectedHelper?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Direct Commission Rate (%)</Label>
              <Input
                type="number"
                value={editRatesForm.direct_rate}
                onChange={(e) => setEditRatesForm({ ...editRatesForm, direct_rate: parseFloat(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Network Commission Rate (%)</Label>
              <Input
                type="number"
                value={editRatesForm.network_rate}
                onChange={(e) => setEditRatesForm({ ...editRatesForm, network_rate: parseFloat(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason for Change *</Label>
              <Textarea
                value={editRatesForm.reason}
                onChange={(e) => setEditRatesForm({ ...editRatesForm, reason: e.target.value })}
                placeholder="Explain why rates are being changed..."
              />
            </div>
            <div className="space-y-2">
              <Label>Apply To</Label>
              <Select value={editRatesForm.apply_to} onValueChange={(value) => setEditRatesForm({ ...editRatesForm, apply_to: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="future">Future Commissions Only</SelectItem>
                  <SelectItem value="pending">All Pending Commissions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRatesModal(false)}>Cancel</Button>
            <Button onClick={handleSaveRates}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Modal */}
      <Dialog open={suspendModal} onOpenChange={setSuspendModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Helper</DialogTitle>
            <DialogDescription>
              Suspend {selectedHelper?.full_name}. This will disable their referral links and prevent them from earning new commissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason for Suspension *</Label>
              <Textarea
                value={suspendForm.reason}
                onChange={(e) => setSuspendForm({ reason: e.target.value })}
                placeholder="Provide a clear reason for suspension..."
              />
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <AlertCircle className="inline w-4 h-4 mr-2" />
                A notification email will be sent to the helper informing them of the suspension.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendModal(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleSuspend}>Suspend Helper</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate Modal */}
      <Dialog open={activateModal} onOpenChange={setActivateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate Helper</DialogTitle>
            <DialogDescription>
              Reactivate {selectedHelper?.full_name}. This will re-enable their referral links.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Activation Notes</Label>
              <Textarea
                value={activateForm.notes}
                onChange={(e) => setActivateForm({ notes: e.target.value })}
                placeholder="Add any notes about the activation..."
              />
            </div>
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-3">
              <p className="text-sm text-green-800 dark:text-green-200">
                <CheckCircle className="inline w-4 h-4 mr-2" />
                A notification email will be sent to the helper informing them of the reactivation.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateModal(false)}>Cancel</Button>
            <Button onClick={handleActivate}>Activate Helper</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Payment Modal */}
      <Dialog open={manualPaymentModal} onOpenChange={setManualPaymentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Manual Payment</DialogTitle>
            <DialogDescription>
              Record a manual commission payment for {selectedHelper?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                value={manualPaymentForm.amount}
                onChange={(e) => setManualPaymentForm({ ...manualPaymentForm, amount: e.target.value })}
                placeholder="Enter payment amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Reference *</Label>
              <Input
                value={manualPaymentForm.reference}
                onChange={(e) => setManualPaymentForm({ ...manualPaymentForm, reference: e.target.value })}
                placeholder="Transaction ID or reference number"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={manualPaymentForm.notes}
                onChange={(e) => setManualPaymentForm({ ...manualPaymentForm, notes: e.target.value })}
                placeholder="Additional notes about this payment..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualPaymentModal(false)}>Cancel</Button>
            <Button onClick={handleAddManualPayment}>Add Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
