import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { format } from "date-fns";
import {
  Eye, CheckCircle, XCircle, Search, Ban, UserCheck, TrendingUp, User,
  Users, CreditCard, DollarSign, Globe, Settings, Home, LogOut, ExternalLink,
  UserCircle, Shield, ClipboardList
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/hooks/use-toast";

export default function Applications() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast: toastHook } = useToast();
  const [adminName, setAdminName] = useState("");
  const [applications, setApplications] = useState<any[]>([]);
  const [helpers, setHelpers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [selectedHelper, setSelectedHelper] = useState<any>(null);
  const [recruiterName, setRecruiterName] = useState("");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReconsiderModal, setShowReconsiderModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [sortBy, setSortBy] = useState("newest");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const initializeAuth = async () => {
      // Check for superadmin session
      const session = sessionStorage.getItem('superadmin_session');
      if (session) {
        const sessionData = JSON.parse(session);
        setAdminName(sessionData.fullName);
        loadApplications();
        loadHelpers();
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
        toastHook({
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
      loadApplications();
      loadHelpers();
    };

    initializeAuth();
  }, [navigate]);

  useEffect(() => {
    if (selectedApp?.recruited_by_helper_id) {
      loadRecruiterName(selectedApp.recruited_by_helper_id);
    } else {
      setRecruiterName("");
    }
  }, [selectedApp]);

  const loadRecruiterName = async (recruiterId: string) => {
    try {
      const { data, error } = await supabase
        .from("helpers")
        .select("full_name")
        .eq("id", recruiterId)
        .single();

      if (error) throw error;
      setRecruiterName(data?.full_name || "");
    } catch (error) {
      console.error("Error loading recruiter:", error);
    }
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
    } finally {
      setLoading(false);
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

      const enrichedHelpers = (helpersData || []).map((helper: any) => ({
        ...helper,
        store_referrals_count: helper.store_referrals?.length || 0,
        recruited_helpers_count: helper.recruited_helpers?.length || 0,
        total_commission: 0,
      }));

      setHelpers(enrichedHelpers);
    } catch (error) {
      console.error("Error loading helpers:", error);
      toast.error("Failed to load helpers");
    }
  };

  const handleApprove = async (application: any) => {
    try {
      const { count } = await supabase
        .from("helpers")
        .select("*", { count: "exact", head: true });

      const referralCode = `HELP${String((count || 0) + 1).padStart(3, "0")}`;
      const baseUrl = window.location.origin;

      const { error: helperError } = await supabase.from("helpers").insert({
        id: application.user_id, // CRITICAL: Set helper id to match auth user id for login
        application_id: application.id,
        full_name: application.full_name,
        email: application.email,
        phone: application.phone,
        referral_code: referralCode,
        store_referral_link: `${baseUrl}/signup?ref=${referralCode}`,
        helper_recruitment_link: `${baseUrl}/become-helper?ref=${referralCode}`,
        recruited_by_helper_id: application.recruited_by_helper_id,
        status: "Active",
      });

      if (helperError) throw helperError;

      const { error: updateError } = await supabase
        .from("helper_applications")
        .update({
          application_status: "Approved",
          approved_at: new Date().toISOString(),
        })
        .eq("id", application.id);

      if (updateError) throw updateError;

      toast.success("Helper approved and activated!");
      setShowDetailsModal(false);
      setShowReconsiderModal(false);
      loadApplications();
      loadHelpers();
    } catch (error) {
      console.error("Error approving application:", error);
      toast.error("Failed to approve application");
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
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
        .eq("id", selectedApp.id);

      if (error) throw error;

      toast.success("Application rejected");
      setShowRejectModal(false);
      setShowDetailsModal(false);
      setRejectionReason("");
      loadApplications();
    } catch (error) {
      console.error("Error rejecting application:", error);
      toast.error("Failed to reject application");
    }
  };

  const handleReconsider = async (application: any) => {
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
      setShowReconsiderModal(false);
      loadApplications();
    } catch (error) {
      console.error("Error reconsidering application:", error);
      toast.error("Failed to reconsider application");
    }
  };

  const handleSuspend = async (helper: any) => {
    try {
      const newStatus = helper.status === "Active" ? "Suspended" : "Active";

      const { error } = await supabase
        .from("helpers")
        .update({ status: newStatus })
        .eq("id", helper.id);

      if (error) throw error;

      toast.success(`Helper ${newStatus.toLowerCase()}`);
      setShowSuspendModal(false);
      loadHelpers();
    } catch (error) {
      console.error("Error updating helper status:", error);
      toast.error("Failed to update helper status");
    }
  };

  const getSortedAndFiltered = (apps: any[]) => {
    let filtered = apps.filter((app) => {
      const matchesSearch =
        app.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.phone?.includes(searchTerm);

      const appDate = new Date(app.created_at);
      const matchesDateFrom = !dateFrom || appDate >= new Date(dateFrom);
      const matchesDateTo = !dateTo || appDate <= new Date(dateTo);

      return matchesSearch && matchesDateFrom && matchesDateTo;
    });

    filtered.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === "name-az") return a.full_name.localeCompare(b.full_name);
      if (sortBy === "name-za") return b.full_name.localeCompare(a.full_name);
      return 0;
    });

    return filtered;
  };

  const pendingApps = getSortedAndFiltered(applications.filter(a => a.application_status === "Pending"));
  const rejectedApps = getSortedAndFiltered(applications.filter(a => a.application_status === "Rejected"));

  const PendingTable = ({ apps }: { apps: any[] }) => (
    <div className="space-y-4">
      {apps.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No pending applications</CardContent></Card>
      ) : (
        apps.map((app) => (
          <Card key={app.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-semibold">{app.full_name}</h3>
                    <Badge className="bg-yellow-500">Pending</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Email:</span> {app.email}</div>
                    <div><span className="text-muted-foreground">Phone:</span> {app.phone}</div>
                    <div><span className="text-muted-foreground">Applied:</span> {format(new Date(app.created_at), "PPP")}</div>
                    <div><span className="text-muted-foreground">ID:</span> {app.id.slice(0, 8).toUpperCase()}</div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{app.why_helper}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => { setSelectedApp(app); setShowDetailsModal(true); }}>
                    <Eye className="w-4 h-4 mr-1" />View
                  </Button>
                  <Button variant="default" size="sm" onClick={() => handleApprove(app)}>
                    <CheckCircle className="w-4 h-4 mr-1" />Approve
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => { setSelectedApp(app); setShowRejectModal(true); }}>
                    <XCircle className="w-4 h-4 mr-1" />Reject
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const ApprovedTable = () => {
    const approvedHelpers = helpers.filter(h => {
      const app = applications.find(a => a.id === h.application_id);
      if (!app) return false;

      const matchesSearch =
        h.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.phone?.includes(searchTerm);

      const helperDate = new Date(h.created_at);
      const matchesDateFrom = !dateFrom || helperDate >= new Date(dateFrom);
      const matchesDateTo = !dateTo || helperDate <= new Date(dateTo);

      return matchesSearch && matchesDateFrom && matchesDateTo;
    });

    return (
      <div className="space-y-4">
        {approvedHelpers.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No approved helpers</CardContent></Card>
        ) : (
          approvedHelpers.map((helper) => (
            <Card key={helper.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-semibold">{helper.full_name}</h3>
                      <Badge className={helper.status === "Active" ? "bg-green-500" : "bg-red-500"}>
                        {helper.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Email:</span> {helper.email}</div>
                      <div><span className="text-muted-foreground">Phone:</span> {helper.phone}</div>
                      <div><span className="text-muted-foreground">Code:</span> <span className="font-mono font-semibold">{helper.referral_code}</span></div>
                      <div><span className="text-muted-foreground">Approved:</span> {format(new Date(helper.created_at), "PPP")}</div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        <span className="text-muted-foreground">Stores:</span> <span className="font-semibold">{helper.store_referrals_count}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4 text-purple-500" />
                        <span className="text-muted-foreground">Helpers:</span> <span className="font-semibold">{helper.recruited_helpers_count}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => { setSelectedHelper(helper); const app = applications.find(a => a.id === helper.application_id); setSelectedApp(app); setShowDetailsModal(true); }}>
                      <Eye className="w-4 h-4 mr-1" />Profile
                    </Button>
                    <Button variant={helper.status === "Active" ? "destructive" : "default"} size="sm" onClick={() => { setSelectedHelper(helper); setShowSuspendModal(true); }}>
                      {helper.status === "Active" ? <><Ban className="w-4 h-4 mr-1" />Suspend</> : <><UserCheck className="w-4 h-4 mr-1" />Activate</>}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  };

  const RejectedTable = ({ apps }: { apps: any[] }) => (
    <div className="space-y-4">
      {apps.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No rejected applications</CardContent></Card>
      ) : (
        apps.map((app) => (
          <Card key={app.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-semibold">{app.full_name}</h3>
                    <Badge className="bg-red-500">Rejected</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Email:</span> {app.email}</div>
                    <div><span className="text-muted-foreground">Phone:</span> {app.phone}</div>
                    <div><span className="text-muted-foreground">Rejected:</span> {format(new Date(app.created_at), "PPP")}</div>
                  </div>
                  {app.rejection_reason && (
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Rejection Reason:</p>
                      <p className="text-sm text-red-900 dark:text-red-100">{app.rejection_reason}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => { setSelectedApp(app); setShowDetailsModal(true); }}>
                    <Eye className="w-4 h-4 mr-1" />View
                  </Button>
                  <Button variant="default" size="sm" onClick={() => { setSelectedApp(app); setShowReconsiderModal(true); }}>
                    <CheckCircle className="w-4 h-4 mr-1" />Reconsider
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const handleLogout = () => {
    sessionStorage.removeItem('superadmin_session');
    localStorage.removeItem('superadmin_remember');
    toastHook({
      title: "Logged Out",
      description: "You have been logged out successfully",
    });
    navigate('/superadmin/login');
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

          <div className="flex items-center gap-3">
            <ThemeToggle />
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
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-card min-h-screen p-4">
          <nav className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => navigate('/superadmin/dashboard')}
            >
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
              variant="default"
              className="w-full justify-start"
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              Helper Applications
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
              onClick={() => navigate('/superadmin/billing')}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Billing & Revenue
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
          <div>
            <h1 className="text-3xl font-bold">Helper Applications</h1>
            <p className="text-muted-foreground">Review and manage helper applications</p>
          </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input placeholder="Search by name, email, or phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <div>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="name-az">Name A-Z</SelectItem>
                    <SelectItem value="name-za">Name Z-A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="From" className="flex-1" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="To" className="flex-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending">Pending ({pendingApps.length})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({helpers.length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({rejectedApps.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending"><PendingTable apps={pendingApps} /></TabsContent>
          <TabsContent value="approved"><ApprovedTable /></TabsContent>
          <TabsContent value="rejected"><RejectedTable apps={rejectedApps} /></TabsContent>
        </Tabs>

        {/* Details Modal */}
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Application Details</DialogTitle>
              <DialogDescription>Review complete application information</DialogDescription>
            </DialogHeader>
            {selectedApp && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-muted-foreground">Full Name</Label><p className="font-medium">{selectedApp.full_name}</p></div>
                  <div><Label className="text-muted-foreground">Email</Label><p className="font-medium">{selectedApp.email}</p></div>
                  <div><Label className="text-muted-foreground">Phone</Label><p className="font-medium">{selectedApp.phone}</p></div>
                  <div><Label className="text-muted-foreground">Application Date</Label><p className="font-medium">{format(new Date(selectedApp.created_at), "PPP")}</p></div>
                </div>

                {recruiterName && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm"><span className="font-semibold text-blue-900 dark:text-blue-100">Recruited by:</span> {recruiterName}</p>
                  </div>
                )}

                <div><Label className="text-muted-foreground">Why Helper?</Label><p className="mt-2 text-sm whitespace-pre-wrap">{selectedApp.why_helper}</p></div>

                <div>
                  <Label className="text-lg font-semibold">Bank Details</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div><Label className="text-muted-foreground">Account Holder</Label><p className="font-medium">{selectedApp.bank_account_name}</p></div>
                    <div><Label className="text-muted-foreground">Account Number</Label><p className="font-medium">{selectedApp.bank_account_number}</p></div>
                    <div><Label className="text-muted-foreground">IFSC Code</Label><p className="font-medium">{selectedApp.bank_ifsc_code}</p></div>
                    <div><Label className="text-muted-foreground">Bank Name</Label><p className="font-medium">{selectedApp.bank_name}</p></div>
                  </div>
                </div>

                {selectedApp.application_status === "Pending" && (
                  <div className="flex gap-3">
                    <Button onClick={() => handleApprove(selectedApp)} className="flex-1"><CheckCircle className="w-4 h-4 mr-2" />Approve Application</Button>
                    <Button variant="destructive" onClick={() => setShowRejectModal(true)} className="flex-1"><XCircle className="w-4 h-4 mr-2" />Reject Application</Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Modal */}
        <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Application</DialogTitle>
              <DialogDescription>Please provide a reason for rejection</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Rejection Reason *</Label>
                <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Enter the reason for rejecting this application..." className="mt-2" />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowRejectModal(false)} className="flex-1">Cancel</Button>
                <Button variant="destructive" onClick={handleReject} className="flex-1">Confirm Rejection</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Reconsider Modal */}
        <Dialog open={showReconsiderModal} onOpenChange={setShowReconsiderModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reconsider Application</DialogTitle>
              <DialogDescription>Move this application back to pending status?</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">This will clear the rejection reason and allow you to review the application again.</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowReconsiderModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={() => selectedApp && handleReconsider(selectedApp)} className="flex-1">Move to Pending</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Suspend Modal */}
        <Dialog open={showSuspendModal} onOpenChange={setShowSuspendModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedHelper?.status === "Active" ? "Suspend Helper" : "Activate Helper"}</DialogTitle>
              <DialogDescription>Are you sure you want to {selectedHelper?.status === "Active" ? "suspend" : "activate"} this helper?</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{selectedHelper?.status === "Active" ? "Suspended helpers cannot earn commissions or recruit new helpers." : "This helper will be able to earn commissions and recruit new helpers again."}</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowSuspendModal(false)} className="flex-1">Cancel</Button>
                <Button variant={selectedHelper?.status === "Active" ? "destructive" : "default"} onClick={() => selectedHelper && handleSuspend(selectedHelper)} className="flex-1">Confirm</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </main>
      </div>
    </div>
  );
}
