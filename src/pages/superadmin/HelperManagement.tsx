import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Eye,
  CheckCircle,
  XCircle,
  Search,
  Ban,
  UserCheck,
  Users,
  FileText,
  Trash2,
  Edit,
  DollarSign,
  TrendingUp,
  Network,
} from "lucide-react";
import ViewHelperDetailsModal from "@/components/superadmin/ViewHelperDetailsModal";

interface HelperApplication {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  why_helper: string;
  application_status: string;
  created_at: string;
  recruited_by_helper_id?: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_ifsc_code: string;
  bank_name: string;
  rejection_reason?: string;
}

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
  application_id?: string;
}

type CombinedData = (HelperApplication | Helper) & {
  type?: 'application' | 'helper';
};

export default function HelperManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");

  // Data
  const [applications, setApplications] = useState<HelperApplication[]>([]);
  const [helpers, setHelpers] = useState<Helper[]>([]);

  // Modals
  const [viewDetailsModal, setViewDetailsModal] = useState(false);
  const [viewHelperModal, setViewHelperModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [editRatesModal, setEditRatesModal] = useState(false);

  // Selected items
  const [selectedApplication, setSelectedApplication] = useState<HelperApplication | null>(null);
  const [selectedHelper, setSelectedHelper] = useState<Helper | null>(null);

  // Forms
  const [rejectionReason, setRejectionReason] = useState("");
  const [editRatesForm, setEditRatesForm] = useState({
    direct_rate: 10,
    network_rate: 5,
    reason: "",
  });

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    const session = sessionStorage.getItem('superadmin_session');
    if (!session) {
      navigate('/superadmin/login');
      return;
    }
    await loadData();
    setLoading(false);
  };

  const loadData = async () => {
    await Promise.all([loadApplications(), loadHelpers()]);
  };

  const loadApplications = async () => {
    try {
      const { data, error } = await supabase
        .from("helper_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error("Error loading applications:", error);
      toast.error("Failed to load applications");
    }
  };

  const loadHelpers = async () => {
    try {
      const { data, error } = await supabase
        .from("helpers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHelpers(data || []);
    } catch (error) {
      console.error("Error loading helpers:", error);
      toast.error("Failed to load helpers");
    }
  };

  // Stats - exclude approved applications to avoid duplication
  const nonApprovedApplications = applications.filter(a => a.application_status !== "Approved");

  const stats = {
    total: nonApprovedApplications.length + helpers.length,
    pending: applications.filter(a => a.application_status === "Pending").length,
    approved: helpers.filter(h => h.status === "Active").length,
    rejected: applications.filter(a => a.application_status === "Rejected").length,
    suspended: helpers.filter(h => h.status === "Suspended").length,
  };

  // Filter data based on tab
  const getFilteredData = (): CombinedData[] => {
    let data: CombinedData[] = [];

    switch (activeTab) {
      case "pending":
        data = applications
          .filter(a => a.application_status === "Pending")
          .map(a => ({ ...a, type: 'application' as const }));
        break;
      case "approved":
        data = helpers.map(h => ({ ...h, type: 'helper' as const }));
        break;
      case "rejected":
        data = applications
          .filter(a => a.application_status === "Rejected")
          .map(a => ({ ...a, type: 'application' as const }));
        break;
      case "all":
        // Exclude approved applications to avoid showing duplicates (they're already in helpers table)
        data = [
          ...applications
            .filter(a => a.application_status !== "Approved")
            .map(a => ({ ...a, type: 'application' as const })),
          ...helpers.map(h => ({ ...h, type: 'helper' as const }))
        ];
        break;
    }

    // Apply search
    if (searchTerm) {
      data = data.filter(item =>
        item.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.phone?.includes(searchTerm)
      );
    }

    return data;
  };

  const handleApprove = async (application: HelperApplication) => {
    try {
      // Call database RPC function with SECURITY DEFINER (bypasses RLS)
      const { data: result, error } = await supabase.rpc('approve_helper_application', {
        p_application_id: application.id
      });

      if (error) {
        console.error("Error calling approve RPC:", error);
        throw new Error(error.message || "Failed to approve helper");
      }

      if (!result?.success) {
        console.error("Approve helper failed:", result);
        throw new Error(result?.error || "Approval operation failed");
      }

      toast.success(`Helper approved! Referral code: ${result.referralCode}`);
      await loadData();
    } catch (error: any) {
      console.error("Error approving application:", error);
      toast.error(error.message || "Failed to approve application");
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim() || !selectedApplication) {
      toast.error("Please provide a rejection reason");
      return;
    }

    try {
      const { error } = await supabase
        .from("helper_applications")
        .update({
          application_status: "Rejected",
          rejection_reason: rejectionReason,
        })
        .eq("id", selectedApplication.id);

      if (error) throw error;

      toast.success("Application rejected");
      setRejectModal(false);
      setRejectionReason("");
      setSelectedApplication(null);
      await loadData();
    } catch (error) {
      console.error("Error rejecting application:", error);
      toast.error("Failed to reject application");
    }
  };

  const handleReconsider = async (application: HelperApplication) => {
    try {
      const { error } = await supabase
        .from("helper_applications")
        .update({
          application_status: "Pending",
          rejection_reason: null,
        })
        .eq("id", application.id);

      if (error) throw error;

      toast.success("Application moved to pending");
      await loadData();
    } catch (error) {
      console.error("Error reconsidering application:", error);
      toast.error("Failed to reconsider application");
    }
  };

  const handleSuspend = async (helper: Helper) => {
    try {
      const newStatus = helper.status === "Active" ? "Suspended" : "Active";

      const { error } = await supabase
        .from("helpers")
        .update({ status: newStatus })
        .eq("id", helper.id);

      if (error) throw error;

      toast.success(`Helper ${newStatus.toLowerCase()}`);
      await loadData();
    } catch (error) {
      console.error("Error updating helper status:", error);
      toast.error("Failed to update helper status");
    }
  };

  const handleDelete = async () => {
    if (!selectedApplication && !selectedHelper) return;

    try {
      const userId = selectedApplication?.user_id || selectedHelper?.id;
      const deleteType = selectedApplication ? 'application' : 'helper';

      if (!userId) {
        toast.error("Cannot delete: User ID not found");
        return;
      }

      const { data: result, error } = await supabase.functions.invoke('delete-helper', {
        body: { userId, deleteType }
      });

      if (error) {
        // Check if it's a blocked deletion (403 Forbidden)
        if (error.message?.includes('BLOCKED') || error.message?.includes('store owner')) {
          toast.error(`🚫 ${error.message}`, { duration: 8000 });
          setDeleteModal(false);
          return;
        }
        throw new Error(error.message || "Failed to delete");
      }

      if (!result?.success) {
        // Check for blocked deletion in result
        if (result?.error?.includes('BLOCKED') || result?.error?.includes('store owner')) {
          toast.error(`🚫 ${result.error}`, { duration: 8000 });
          setDeleteModal(false);
          return;
        }
        throw new Error(result?.error || "Delete operation failed");
      }

      if (selectedApplication) {
        await supabase.from("helper_applications").delete().eq("id", selectedApplication.id);
      } else if (selectedHelper) {
        await supabase.from("helpers").delete().eq("id", selectedHelper.id);
      }

      toast.success("Deleted successfully");
      setDeleteModal(false);
      setSelectedApplication(null);
      setSelectedHelper(null);
      await loadData();
    } catch (error: any) {
      console.error("Error deleting:", error);
      toast.error(error.message || "Failed to delete");
    }
  };

  const handleSaveRates = async () => {
    if (!editRatesForm.reason || !selectedHelper) {
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
        .eq("id", selectedHelper.id);

      if (error) throw error;

      toast.success("Commission rates updated successfully");
      setEditRatesModal(false);
      await loadData();
    } catch (error) {
      console.error("Error updating rates:", error);
      toast.error("Failed to update commission rates");
    }
  };

  const getStatusBadge = (item: CombinedData) => {
    let status = '';
    let color = '';

    if (item.type === 'application') {
      const app = item as HelperApplication;
      status = app.application_status;
      switch (status) {
        case 'Pending':
          color = 'bg-yellow-500';
          break;
        case 'Rejected':
          color = 'bg-red-500';
          break;
        case 'Approved':
          color = 'bg-green-500';
          break;
        default:
          color = 'bg-gray-500';
      }
    } else {
      const helper = item as Helper;
      status = helper.status;
      switch (status) {
        case 'Active':
          color = 'bg-green-500';
          break;
        case 'Suspended':
          color = 'bg-orange-500';
          break;
        default:
          color = 'bg-gray-500';
      }
    }

    return <Badge className={color}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading helper management...</p>
        </div>
      </div>
    );
  }

  const filteredData = getFilteredData();

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
              Manage all helper applications and approved helpers in one place
            </p>
          </div>
          <Button onClick={() => navigate("/superadmin/dashboard")}>
            Back to Dashboard
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveTab("all")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-full">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveTab("pending")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-full">
                  <FileText className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveTab("approved")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-full">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-green-500">{stats.approved}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveTab("rejected")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-full">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                  <p className="text-2xl font-bold text-red-500">{stats.rejected}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-full">
                  <Ban className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Suspended</p>
                  <p className="text-2xl font-bold text-orange-500">{stats.suspended}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="pending" className="gap-2">
              <FileText className="h-4 w-4" />
              Pending <Badge variant="secondary" className="ml-1">{stats.pending}</Badge>
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Approved <Badge variant="secondary" className="ml-1">{stats.approved + stats.suspended}</Badge>
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              <XCircle className="h-4 w-4" />
              Rejected <Badge variant="secondary" className="ml-1">{stats.rejected}</Badge>
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              <Users className="h-4 w-4" />
              All <Badge variant="secondary" className="ml-1">{stats.total}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* Pending Tab */}
          <TabsContent value="pending">
            <Card>
              <CardContent className="p-0">
                {filteredData.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No pending applications</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Applied On</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.map((item) => {
                          const app = item as HelperApplication;
                          return (
                            <TableRow key={app.id}>
                              <TableCell className="font-medium">{app.full_name}</TableCell>
                              <TableCell>{app.email}</TableCell>
                              <TableCell>{app.phone}</TableCell>
                              <TableCell>{format(new Date(app.created_at), "PP")}</TableCell>
                              <TableCell>{getStatusBadge(item)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedApplication(app);
                                      setViewDetailsModal(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    View
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleApprove(app)}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setSelectedApplication(app);
                                      setRejectModal(true);
                                    }}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Reject
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setSelectedApplication(app);
                                      setDeleteModal(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Approved Tab */}
          <TabsContent value="approved">
            <Card>
              <CardContent className="p-0">
                {filteredData.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No approved helpers</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Helper ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Referral Code</TableHead>
                          <TableHead>Commission Rates</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.map((item) => {
                          const helper = item as Helper;
                          return (
                            <TableRow key={helper.id}>
                              <TableCell className="font-mono">{helper.helper_id}</TableCell>
                              <TableCell className="font-medium">{helper.full_name}</TableCell>
                              <TableCell>{helper.email}</TableCell>
                              <TableCell>{helper.phone}</TableCell>
                              <TableCell className="font-mono">{helper.referral_code}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <div>Direct: {helper.direct_commission_rate}%</div>
                                  <div>Network: {helper.network_commission_rate}%</div>
                                </div>
                              </TableCell>
                              <TableCell>{getStatusBadge(item)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedHelper(helper);
                                      setViewHelperModal(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    View
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedHelper(helper);
                                      setEditRatesForm({
                                        direct_rate: helper.direct_commission_rate,
                                        network_rate: helper.network_commission_rate,
                                        reason: "",
                                      });
                                      setEditRatesModal(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={helper.status === "Active" ? "destructive" : "default"}
                                    onClick={() => handleSuspend(helper)}
                                  >
                                    {helper.status === "Active" ? (
                                      <><Ban className="h-4 w-4 mr-1" />Suspend</>
                                    ) : (
                                      <><UserCheck className="h-4 w-4 mr-1" />Activate</>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setSelectedHelper(helper);
                                      setDeleteModal(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rejected Tab */}
          <TabsContent value="rejected">
            <Card>
              <CardContent className="p-0">
                {filteredData.length === 0 ? (
                  <div className="text-center py-12">
                    <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No rejected applications</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Rejected On</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.map((item) => {
                          const app = item as HelperApplication;
                          return (
                            <TableRow key={app.id}>
                              <TableCell className="font-medium">{app.full_name}</TableCell>
                              <TableCell>{app.email}</TableCell>
                              <TableCell>{app.phone}</TableCell>
                              <TableCell>{format(new Date(app.created_at), "PP")}</TableCell>
                              <TableCell className="max-w-xs truncate">
                                {app.rejection_reason || "No reason provided"}
                              </TableCell>
                              <TableCell>{getStatusBadge(item)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedApplication(app);
                                      setViewDetailsModal(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    View
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleReconsider(app)}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Reconsider
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setSelectedApplication(app);
                                      setDeleteModal(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Tab */}
          <TabsContent value="all">
            <Card>
              <CardContent className="p-0">
                {filteredData.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No helpers or applications found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.map((item) => {
                          const isHelper = item.type === 'helper';
                          const helper = isHelper ? item as Helper : null;
                          const app = !isHelper ? item as HelperApplication : null;

                          return (
                            <TableRow key={isHelper ? helper!.id : app!.id}>
                              <TableCell>
                                <Badge variant="outline">
                                  {isHelper ? 'Helper' : 'Application'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">{item.full_name}</TableCell>
                              <TableCell>{item.email}</TableCell>
                              <TableCell>{item.phone}</TableCell>
                              <TableCell>{format(new Date(item.created_at), "PP")}</TableCell>
                              <TableCell>{getStatusBadge(item)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                  {isHelper ? (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedHelper(helper!);
                                          setViewHelperModal(true);
                                        }}
                                      >
                                        <Eye className="h-4 w-4 mr-1" />
                                        View
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedHelper(helper!);
                                          setEditRatesForm({
                                            direct_rate: helper!.direct_commission_rate,
                                            network_rate: helper!.network_commission_rate,
                                            reason: "",
                                          });
                                          setEditRatesModal(true);
                                        }}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant={helper!.status === "Active" ? "destructive" : "default"}
                                        onClick={() => handleSuspend(helper!)}
                                      >
                                        {helper!.status === "Active" ? <Ban className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => {
                                          setSelectedHelper(helper!);
                                          setDeleteModal(true);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedApplication(app!);
                                          setViewDetailsModal(true);
                                        }}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      {app!.application_status === "Pending" && (
                                        <>
                                          <Button size="sm" variant="default" onClick={() => handleApprove(app!)}>
                                            <CheckCircle className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => {
                                              setSelectedApplication(app!);
                                              setRejectModal(true);
                                            }}
                                          >
                                            <XCircle className="h-4 w-4" />
                                          </Button>
                                        </>
                                      )}
                                      {app!.application_status === "Rejected" && (
                                        <Button size="sm" variant="default" onClick={() => handleReconsider(app!)}>
                                          <CheckCircle className="h-4 w-4" />
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => {
                                          setSelectedApplication(app!);
                                          setDeleteModal(true);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* View Details Modal */}
        <Dialog open={viewDetailsModal} onOpenChange={setViewDetailsModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Application Details</DialogTitle>
              <DialogDescription>
                {selectedApplication?.full_name} - {selectedApplication?.email}
              </DialogDescription>
            </DialogHeader>
            {selectedApplication && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Full Name</Label>
                    <p className="text-sm">{selectedApplication.full_name}</p>
                  </div>
                  <div>
                    <Label>Email</Label>
                    <p className="text-sm">{selectedApplication.email}</p>
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <p className="text-sm">{selectedApplication.phone}</p>
                  </div>
                  <div>
                    <Label>Applied On</Label>
                    <p className="text-sm">{format(new Date(selectedApplication.created_at), "PPP")}</p>
                  </div>
                </div>
                <div>
                  <Label>Why Helper?</Label>
                  <p className="text-sm mt-1">{selectedApplication.why_helper || "Not provided"}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Bank Account Name</Label>
                    <p className="text-sm">{selectedApplication.bank_account_name}</p>
                  </div>
                  <div>
                    <Label>Bank Name</Label>
                    <p className="text-sm">{selectedApplication.bank_name}</p>
                  </div>
                  <div>
                    <Label>Account Number</Label>
                    <p className="text-sm font-mono">{selectedApplication.bank_account_number}</p>
                  </div>
                  <div>
                    <Label>IFSC Code</Label>
                    <p className="text-sm font-mono">{selectedApplication.bank_ifsc_code}</p>
                  </div>
                </div>
                {selectedApplication.rejection_reason && (
                  <div>
                    <Label>Rejection Reason</Label>
                    <p className="text-sm mt-1 text-red-500">{selectedApplication.rejection_reason}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Modal */}
        <Dialog open={rejectModal} onOpenChange={setRejectModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Application</DialogTitle>
              <DialogDescription>
                Provide a reason for rejecting {selectedApplication?.full_name}'s application
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Rejection Reason *</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter the reason for rejection..."
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectModal(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReject}>
                Reject Application
              </Button>
            </DialogFooter>
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
              <div>
                <Label>Direct Commission Rate (%)</Label>
                <Input
                  type="number"
                  value={editRatesForm.direct_rate}
                  onChange={(e) =>
                    setEditRatesForm({ ...editRatesForm, direct_rate: parseFloat(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Network Commission Rate (%)</Label>
                <Input
                  type="number"
                  value={editRatesForm.network_rate}
                  onChange={(e) =>
                    setEditRatesForm({ ...editRatesForm, network_rate: parseFloat(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Reason for Change *</Label>
                <Textarea
                  value={editRatesForm.reason}
                  onChange={(e) => setEditRatesForm({ ...editRatesForm, reason: e.target.value })}
                  placeholder="Explain why rates are being changed..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditRatesModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRates}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <AlertDialog open={deleteModal} onOpenChange={setDeleteModal}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>⚠️ Permanently Delete?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete{" "}
                <strong>{selectedApplication?.full_name || selectedHelper?.full_name}</strong> and ALL
                related data:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {selectedHelper ? (
                    <>
                      <li>Helper account and profile</li>
                      <li>All store referrals</li>
                      <li>All commission records</li>
                      <li>All network connections</li>
                    </>
                  ) : (
                    <>
                      <li>Application record</li>
                      <li>Profile information</li>
                    </>
                  )}
                  <li>User authentication account</li>
                </ul>
                <p className="mt-3 font-bold text-destructive">This action cannot be undone!</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* View Helper Details Modal */}
        {selectedHelper && (
          <ViewHelperDetailsModal
            open={viewHelperModal}
            onOpenChange={setViewHelperModal}
            helperId={selectedHelper.id}
            helperName={selectedHelper.full_name}
          />
        )}
      </div>
    </div>
  );
}
