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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  UserCircle,
  LogOut,
  Settings,
  ArrowLeft,
  DollarSign,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  Filter
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface DirectCommission {
  id: string;
  date_earned: string;
  store_owner_name: string;
  subscription_plan: string;
  plan_amount: number;
  commission_amount: number;
  commission_status: string;
  payment_date: string | null;
  payment_reference: string | null;
}

interface NetworkCommission {
  id: string;
  date_earned: string;
  helper_name: string;
  customer_name: string;
  helper_commission: number;
  network_commission: number;
  commission_status: string;
  payment_date: string | null;
  payment_reference: string | null;
}

export default function CommissionHistory() {
  const navigate = useNavigate();
  const { toast: toastHook } = useToast();
  const [loading, setLoading] = useState(true);
  const [helper, setHelper] = useState<any>(null);
  const [directCommissions, setDirectCommissions] = useState<DirectCommission[]>([]);
  const [networkCommissions, setNetworkCommissions] = useState<NetworkCommission[]>([]);
  const [filteredDirect, setFilteredDirect] = useState<DirectCommission[]>([]);
  const [filteredNetwork, setFilteredNetwork] = useState<NetworkCommission[]>([]);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Stats
  const [stats, setStats] = useState({
    direct: { total: 0, pending: 0, paid: 0, pendingCount: 0, paidCount: 0 },
    network: { total: 0, pending: 0, paid: 0, pendingCount: 0, paidCount: 0 },
    grand: { total: 0, pending: 0, paid: 0, nextPaymentDate: "" }
  });

  useEffect(() => {
    checkHelperAccess();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [directCommissions, networkCommissions, dateFrom, dateTo, statusFilter, typeFilter]);

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
      await loadCommissions(helperData.id);
      setLoading(false);
    } catch (error) {
      console.error("Error checking helper access:", error);
      navigate("/auth");
    }
  };

  const loadCommissions = async (helperId: string) => {
    try {
      // Get all commissions for this helper
      const { data: commissions, error } = await supabase
        .from("network_commissions")
        .select(`
          *,
          store_referral:store_referrals(
            store_owner_name,
            store_owner_email,
            subscription_plan,
            subscription_amount
          )
        `)
        .eq("earning_helper_id", helperId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Separate direct and network commissions
      const direct: DirectCommission[] = [];
      const network: NetworkCommission[] = [];

      for (const commission of commissions || []) {
        // Direct commission (from store owners)
        if (commission.direct_commission_amount > 0) {
          direct.push({
            id: commission.id,
            date_earned: commission.created_at,
            store_owner_name: commission.store_referral?.store_owner_name || "N/A",
            subscription_plan: commission.store_referral?.subscription_plan || "N/A",
            plan_amount: commission.store_referral?.subscription_amount || 0,
            commission_amount: commission.direct_commission_amount,
            commission_status: commission.commission_status,
            payment_date: commission.payment_date,
            payment_reference: commission.payment_reference
          });
        }

        // Network commission (from recruited helpers)
        if (commission.network_commission_amount > 0 && commission.recruiting_helper_id) {
          // Get the recruited helper's info
          const { data: recruitedHelper } = await supabase
            .from("helpers")
            .select("full_name")
            .eq("id", commission.earning_helper_id)
            .single();

          network.push({
            id: commission.id,
            date_earned: commission.created_at,
            helper_name: recruitedHelper?.full_name || "N/A",
            customer_name: commission.store_referral?.store_owner_name || "N/A",
            helper_commission: commission.direct_commission_amount,
            network_commission: commission.network_commission_amount,
            commission_status: commission.commission_status,
            payment_date: commission.payment_date,
            payment_reference: commission.payment_reference
          });
        }
      }

      setDirectCommissions(direct);
      setNetworkCommissions(network);

      // Calculate stats
      const directTotal = direct.reduce((sum, c) => sum + c.commission_amount, 0);
      const directPending = direct.filter(c => c.commission_status.includes("Pending")).reduce((sum, c) => sum + c.commission_amount, 0);
      const directPaid = direct.filter(c => c.commission_status === "Paid").reduce((sum, c) => sum + c.commission_amount, 0);
      const directPendingCount = direct.filter(c => c.commission_status.includes("Pending")).length;
      const directPaidCount = direct.filter(c => c.commission_status === "Paid").length;

      const networkTotal = network.reduce((sum, c) => sum + c.network_commission, 0);
      const networkPending = network.filter(c => c.commission_status.includes("Pending")).reduce((sum, c) => sum + c.network_commission, 0);
      const networkPaid = network.filter(c => c.commission_status === "Paid").reduce((sum, c) => sum + c.network_commission, 0);
      const networkPendingCount = network.filter(c => c.commission_status.includes("Pending")).length;
      const networkPaidCount = network.filter(c => c.commission_status === "Paid").length;

      // Find next payment date (earliest payment date from pending commissions)
      const pendingWithDates = [...direct, ...network]
        .filter(c => c.commission_status.includes("Pending") && c.payment_date)
        .map(c => new Date(c.payment_date!).getTime())
        .sort((a, b) => a - b);

      const nextPaymentDate = pendingWithDates.length > 0
        ? format(new Date(pendingWithDates[0]), "PPP")
        : "TBD";

      setStats({
        direct: {
          total: directTotal,
          pending: directPending,
          paid: directPaid,
          pendingCount: directPendingCount,
          paidCount: directPaidCount
        },
        network: {
          total: networkTotal,
          pending: networkPending,
          paid: networkPaid,
          pendingCount: networkPendingCount,
          paidCount: networkPaidCount
        },
        grand: {
          total: directTotal + networkTotal,
          pending: directPending + networkPending,
          paid: directPaid + networkPaid,
          nextPaymentDate
        }
      });
    } catch (error) {
      console.error("Error loading commissions:", error);
      toast.error("Failed to load commission history");
    }
  };

  const applyFilters = () => {
    let filteredDirect = [...directCommissions];
    let filteredNetwork = [...networkCommissions];

    // Date range filter
    if (dateFrom) {
      filteredDirect = filteredDirect.filter(c => new Date(c.date_earned) >= new Date(dateFrom));
      filteredNetwork = filteredNetwork.filter(c => new Date(c.date_earned) >= new Date(dateFrom));
    }
    if (dateTo) {
      filteredDirect = filteredDirect.filter(c => new Date(c.date_earned) <= new Date(dateTo));
      filteredNetwork = filteredNetwork.filter(c => new Date(c.date_earned) <= new Date(dateTo));
    }

    // Status filter
    if (statusFilter === "pending") {
      filteredDirect = filteredDirect.filter(c => c.commission_status.includes("Pending"));
      filteredNetwork = filteredNetwork.filter(c => c.commission_status.includes("Pending"));
    } else if (statusFilter === "paid") {
      filteredDirect = filteredDirect.filter(c => c.commission_status === "Paid");
      filteredNetwork = filteredNetwork.filter(c => c.commission_status === "Paid");
    }

    // Type filter
    if (typeFilter === "direct") {
      filteredNetwork = [];
    } else if (typeFilter === "network") {
      filteredDirect = [];
    }

    setFilteredDirect(filteredDirect);
    setFilteredNetwork(filteredNetwork);
  };

  const getStatusBadge = (status: string) => {
    if (status === "Paid") {
      return (
        <Badge className="bg-green-500">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Paid
        </Badge>
      );
    } else if (status.includes("Pending")) {
      return (
        <Badge className="bg-yellow-500">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    } else {
      return <Badge variant="outline">{status}</Badge>;
    }
  };

  const exportToExcel = () => {
    try {
      // Prepare direct commissions data
      const directData = filteredDirect.map(c => ({
        "Date Earned": format(new Date(c.date_earned), "PPP"),
        "Store Owner": c.store_owner_name,
        "Subscription Plan": c.subscription_plan,
        "Plan Amount": `₹${c.plan_amount.toLocaleString()}`,
        "Your Commission (10%)": `₹${c.commission_amount.toLocaleString()}`,
        "Status": c.commission_status,
        "Payment Date": c.payment_date ? format(new Date(c.payment_date), "PPP") : "N/A",
        "Payment Reference": c.payment_reference || "N/A"
      }));

      // Prepare network commissions data
      const networkData = filteredNetwork.map(c => ({
        "Date Earned": format(new Date(c.date_earned), "PPP"),
        "Helper Name": c.helper_name,
        "Their Customer": c.customer_name,
        "Their Commission": `₹${c.helper_commission.toLocaleString()}`,
        "Your Network Commission (5%)": `₹${c.network_commission.toLocaleString()}`,
        "Status": c.commission_status,
        "Payment Date": c.payment_date ? format(new Date(c.payment_date), "PPP") : "N/A",
        "Payment Reference": c.payment_reference || "N/A"
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Add direct commissions sheet
      if (directData.length > 0) {
        const ws1 = XLSX.utils.json_to_sheet(directData);
        XLSX.utils.book_append_sheet(wb, ws1, "Direct Commissions");
      }

      // Add network commissions sheet
      if (networkData.length > 0) {
        const ws2 = XLSX.utils.json_to_sheet(networkData);
        XLSX.utils.book_append_sheet(wb, ws2, "Network Commissions");
      }

      // Add summary sheet
      const summaryData = [
        { "Category": "Direct Commissions", "Total": `₹${stats.direct.total.toLocaleString()}`, "Pending": `₹${stats.direct.pending.toLocaleString()}`, "Paid": `₹${stats.direct.paid.toLocaleString()}` },
        { "Category": "Network Commissions", "Total": `₹${stats.network.total.toLocaleString()}`, "Pending": `₹${stats.network.pending.toLocaleString()}`, "Paid": `₹${stats.network.paid.toLocaleString()}` },
        { "Category": "GRAND TOTAL", "Total": `₹${stats.grand.total.toLocaleString()}`, "Pending": `₹${stats.grand.pending.toLocaleString()}`, "Paid": `₹${stats.grand.paid.toLocaleString()}` }
      ];
      const ws3 = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws3, "Summary");

      // Generate file
      const fileName = `commission_history_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Commission history exported successfully!");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Failed to export commission history");
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
          <p className="text-muted-foreground">Loading commission history...</p>
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
              <DollarSign className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Commission History</h1>
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
        {/* Grand Total Card */}
        <Card className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border-green-500/20">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Earned</p>
                <p className="text-3xl font-bold text-green-500">
                  ₹{stats.grand.total.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Direct + Network</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Pending</p>
                <p className="text-3xl font-bold text-yellow-500">
                  ₹{stats.grand.pending.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Awaiting payment</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Paid</p>
                <p className="text-3xl font-bold text-blue-500">
                  ₹{stats.grand.paid.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Received</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Next Payment</p>
                <p className="text-xl font-bold">
                  {stats.grand.nextPaymentDate}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Expected date</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending Only</SelectItem>
                  <SelectItem value="paid">Paid Only</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="direct">Direct Only</SelectItem>
                  <SelectItem value="network">Network Only</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={exportToExcel} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Section 1: Direct Commissions */}
        {typeFilter !== "network" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-green-500" />
              <h2 className="text-2xl font-bold">Direct Commissions</h2>
              <span className="text-muted-foreground">(From Store Owners You Referred)</span>
            </div>

            {/* Direct Summary Card */}
            <Card className="bg-green-500/5 border-green-500/20">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Direct Commission</p>
                    <p className="text-2xl font-bold text-green-500">
                      ₹{stats.direct.total.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Pending</p>
                    <p className="text-xl font-bold text-yellow-500">
                      ₹{stats.direct.pending.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">from {stats.direct.pendingCount} customer{stats.direct.pendingCount !== 1 ? "s" : ""}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Paid</p>
                    <p className="text-xl font-bold text-blue-500">
                      ₹{stats.direct.paid.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">from {stats.direct.paidCount} customer{stats.direct.paidCount !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Direct Commissions Table */}
            <Card>
              <CardContent className="p-0">
                {filteredDirect.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No direct commissions found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date Earned</TableHead>
                          <TableHead>Store Owner</TableHead>
                          <TableHead>Subscription Plan</TableHead>
                          <TableHead>Plan Amount</TableHead>
                          <TableHead>Your Commission (10%)</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Payment Date</TableHead>
                          <TableHead>Reference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDirect.map((commission) => (
                          <TableRow key={commission.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {format(new Date(commission.date_earned), "PP")}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{commission.store_owner_name}</TableCell>
                            <TableCell>{commission.subscription_plan}</TableCell>
                            <TableCell>₹{commission.plan_amount.toLocaleString()}</TableCell>
                            <TableCell className="font-bold text-green-500">
                              ₹{commission.commission_amount.toLocaleString()}
                            </TableCell>
                            <TableCell>{getStatusBadge(commission.commission_status)}</TableCell>
                            <TableCell>
                              {commission.payment_date
                                ? format(new Date(commission.payment_date), "PP")
                                : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {commission.payment_reference || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Section 2: Network Commissions */}
        {typeFilter !== "direct" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-blue-500" />
              <h2 className="text-2xl font-bold">Network Commissions</h2>
              <span className="text-muted-foreground">(From Helpers You Recruited)</span>
            </div>

            {/* Network Summary Card */}
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Network Commission</p>
                    <p className="text-2xl font-bold text-blue-500">
                      ₹{stats.network.total.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Pending</p>
                    <p className="text-xl font-bold text-yellow-500">
                      ₹{stats.network.pending.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">from {stats.network.pendingCount} helper{stats.network.pendingCount !== 1 ? "s" : ""}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Paid</p>
                    <p className="text-xl font-bold text-green-500">
                      ₹{stats.network.paid.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">from {stats.network.paidCount} helper{stats.network.paidCount !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Network Commissions Table */}
            <Card>
              <CardContent className="p-0">
                {filteredNetwork.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No network commissions found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date Earned</TableHead>
                          <TableHead>Helper Name</TableHead>
                          <TableHead>Their Customer</TableHead>
                          <TableHead>Their Commission</TableHead>
                          <TableHead>Your Network Commission (5%)</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Payment Date</TableHead>
                          <TableHead>Reference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredNetwork.map((commission) => (
                          <TableRow key={commission.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {format(new Date(commission.date_earned), "PP")}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{commission.helper_name}</TableCell>
                            <TableCell>{commission.customer_name}</TableCell>
                            <TableCell>₹{commission.helper_commission.toLocaleString()}</TableCell>
                            <TableCell className="font-bold text-blue-500">
                              ₹{commission.network_commission.toLocaleString()}
                            </TableCell>
                            <TableCell>{getStatusBadge(commission.commission_status)}</TableCell>
                            <TableCell>
                              {commission.payment_date
                                ? format(new Date(commission.payment_date), "PP")
                                : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {commission.payment_reference || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
