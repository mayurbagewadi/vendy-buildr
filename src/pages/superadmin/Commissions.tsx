import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { format, differenceInDays } from "date-fns";
import {
  DollarSign,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Eye
} from "lucide-react";
import * as XLSX from "xlsx";

interface Commission {
  id: string;
  helper_name: string;
  helper_id: string;
  store_owner_name: string;
  plan_name: string;
  plan_amount: number;
  commission_amount: number;
  earned_date: string;
  days_pending: number;
  payment_date?: string;
  payment_reference?: string;
}

export default function SuperAdminCommissions() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Commission data
  const [pendingDirectCommissions, setPendingDirectCommissions] = useState<Commission[]>([]);
  const [pendingNetworkCommissions, setPendingNetworkCommissions] = useState<Commission[]>([]);
  const [paidCommissions, setPaidCommissions] = useState<Commission[]>([]);

  // Selection
  const [selectedDirect, setSelectedDirect] = useState<string[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string[]>([]);

  // Modals
  const [markAsPaidModal, setMarkAsPaidModal] = useState(false);
  const [currentTab, setCurrentTab] = useState<"direct" | "network">("direct");

  // Mark as Paid Form
  const [markAsPaidForm, setMarkAsPaidForm] = useState({
    payment_date: format(new Date(), "yyyy-MM-dd"),
    payment_reference: ""
  });

  // Stats
  const [stats, setStats] = useState({
    direct: { total: 0, count: 0, oldestDays: 0 },
    network: { total: 0, count: 0, oldestDays: 0 },
    paid: { total: 0, count: 0 }
  });

  useEffect(() => {
    checkSuperAdminAccess();
  }, []);

  const checkSuperAdminAccess = async () => {
    try {
      const session = sessionStorage.getItem('superadmin_session');
      if (!session) {
        navigate('/superadmin/login');
        return;
      }

      await loadCommissions();
      setLoading(false);
    } catch (error) {
      console.error("Error checking super admin access:", error);
      navigate('/superadmin/login');
    }
  };

  const loadCommissions = async () => {
    try {
      // Load pending direct commissions
      const { data: directData, error: directError } = await supabase
        .from("network_commissions")
        .select(`
          *,
          helper:helpers!earning_helper_id(full_name, id),
          store_referral:store_referrals(store_owner_name, subscription_plan, subscription_amount)
        `)
        .eq("commission_status", "Earned-Pending")
        .gt("direct_commission_amount", 0)
        .order("created_at", { ascending: true });

      if (directError) throw directError;

      const enrichedDirect: Commission[] = (directData || []).map(c => ({
        id: c.id,
        helper_name: c.helper?.full_name || "N/A",
        helper_id: c.helper?.id || "N/A",
        store_owner_name: c.store_referral?.store_owner_name || "N/A",
        plan_name: c.store_referral?.subscription_plan || "N/A",
        plan_amount: c.store_referral?.subscription_amount || 0,
        commission_amount: c.direct_commission_amount,
        earned_date: c.created_at,
        days_pending: differenceInDays(new Date(), new Date(c.created_at))
      }));

      setPendingDirectCommissions(enrichedDirect);

      // Load pending network commissions
      const { data: networkData, error: networkError } = await supabase
        .from("network_commissions")
        .select(`
          *,
          helper:helpers!earning_helper_id(full_name, id),
          store_referral:store_referrals(store_owner_name, subscription_plan, subscription_amount)
        `)
        .eq("commission_status", "Earned-Pending")
        .gt("network_commission_amount", 0)
        .order("created_at", { ascending: true });

      if (networkError) throw networkError;

      const enrichedNetwork: Commission[] = (networkData || []).map(c => ({
        id: c.id,
        helper_name: c.helper?.full_name || "N/A",
        helper_id: c.helper?.id || "N/A",
        store_owner_name: c.store_referral?.store_owner_name || "N/A",
        plan_name: c.store_referral?.subscription_plan || "N/A",
        plan_amount: c.store_referral?.subscription_amount || 0,
        commission_amount: c.network_commission_amount,
        earned_date: c.created_at,
        days_pending: differenceInDays(new Date(), new Date(c.created_at))
      }));

      setPendingNetworkCommissions(enrichedNetwork);

      // Load paid commissions
      const { data: paidData, error: paidError } = await supabase
        .from("network_commissions")
        .select(`
          *,
          helper:helpers!earning_helper_id(full_name, id),
          store_referral:store_referrals(store_owner_name, subscription_plan, subscription_amount)
        `)
        .eq("commission_status", "Paid")
        .order("payment_date", { ascending: false })
        .limit(100);

      if (paidError) throw paidError;

      const enrichedPaid: Commission[] = (paidData || []).map(c => ({
        id: c.id,
        helper_name: c.helper?.full_name || "N/A",
        helper_id: c.helper?.id || "N/A",
        store_owner_name: c.store_referral?.store_owner_name || "N/A",
        plan_name: c.store_referral?.subscription_plan || "N/A",
        plan_amount: c.store_referral?.subscription_amount || 0,
        commission_amount: (c.direct_commission_amount || 0) + (c.network_commission_amount || 0),
        earned_date: c.created_at,
        days_pending: 0,
        payment_date: c.payment_date,
        payment_reference: c.payment_reference
      }));

      setPaidCommissions(enrichedPaid);

      // Calculate stats
      const directTotal = enrichedDirect.reduce((sum, c) => sum + c.commission_amount, 0);
      const directOldest = enrichedDirect.length > 0 ? Math.max(...enrichedDirect.map(c => c.days_pending)) : 0;

      const networkTotal = enrichedNetwork.reduce((sum, c) => sum + c.commission_amount, 0);
      const networkOldest = enrichedNetwork.length > 0 ? Math.max(...enrichedNetwork.map(c => c.days_pending)) : 0;

      const paidTotal = enrichedPaid.reduce((sum, c) => sum + c.commission_amount, 0);

      setStats({
        direct: { total: directTotal, count: enrichedDirect.length, oldestDays: directOldest },
        network: { total: networkTotal, count: enrichedNetwork.length, oldestDays: networkOldest },
        paid: { total: paidTotal, count: enrichedPaid.length }
      });
    } catch (error) {
      console.error("Error loading commissions:", error);
      toast.error("Failed to load commissions");
    }
  };

  const handleSelectAll = (type: "direct" | "network", checked: boolean) => {
    if (type === "direct") {
      if (checked) {
        setSelectedDirect(pendingDirectCommissions.map(c => c.id));
      } else {
        setSelectedDirect([]);
      }
    } else {
      if (checked) {
        setSelectedNetwork(pendingNetworkCommissions.map(c => c.id));
      } else {
        setSelectedNetwork([]);
      }
    }
  };

  const handleSelectOne = (type: "direct" | "network", id: string, checked: boolean) => {
    if (type === "direct") {
      if (checked) {
        setSelectedDirect([...selectedDirect, id]);
      } else {
        setSelectedDirect(selectedDirect.filter(i => i !== id));
      }
    } else {
      if (checked) {
        setSelectedNetwork([...selectedNetwork, id]);
      } else {
        setSelectedNetwork(selectedNetwork.filter(i => i !== id));
      }
    }
  };

  const handleMarkAsPaid = async () => {
    const selectedIds = currentTab === "direct" ? selectedDirect : selectedNetwork;

    if (selectedIds.length === 0) {
      toast.error("Please select at least one commission");
      return;
    }

    if (!markAsPaidForm.payment_reference) {
      toast.error("Please enter payment reference");
      return;
    }

    try {
      const { error } = await supabase
        .from("network_commissions")
        .update({
          commission_status: "Paid",
          payment_date: markAsPaidForm.payment_date,
          payment_reference: markAsPaidForm.payment_reference,
          updated_at: new Date().toISOString()
        })
        .in("id", selectedIds);

      if (error) throw error;

      toast.success(`Successfully marked ${selectedIds.length} commission(s) as paid`);
      setMarkAsPaidModal(false);
      setSelectedDirect([]);
      setSelectedNetwork([]);
      setMarkAsPaidForm({
        payment_date: format(new Date(), "yyyy-MM-dd"),
        payment_reference: ""
      });
      await loadCommissions();
    } catch (error) {
      console.error("Error marking commissions as paid:", error);
      toast.error("Failed to mark commissions as paid");
    }
  };

  const exportToExcel = (type: "direct" | "network" | "paid") => {
    try {
      let data: Commission[] = [];
      let sheetName = "";

      if (type === "direct") {
        data = pendingDirectCommissions;
        sheetName = "Pending Direct Commissions";
      } else if (type === "network") {
        data = pendingNetworkCommissions;
        sheetName = "Pending Network Commissions";
      } else {
        data = paidCommissions;
        sheetName = "Paid Commissions";
      }

      const exportData = data.map(c => ({
        "Helper Name": c.helper_name,
        "Helper ID": c.helper_id,
        "Store Owner": c.store_owner_name,
        "Plan": c.plan_name,
        "Plan Amount": `₹${c.plan_amount.toLocaleString()}`,
        "Commission Amount": `₹${c.commission_amount.toLocaleString()}`,
        "Earned Date": format(new Date(c.earned_date), "PPP"),
        ...(type === "paid"
          ? {
              "Payment Date": c.payment_date ? format(new Date(c.payment_date), "PPP") : "N/A",
              "Payment Reference": c.payment_reference || "N/A"
            }
          : {
              "Days Pending": c.days_pending
            })
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const fileName = `${sheetName.toLowerCase().replace(/ /g, "_")}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Export successful!");
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Failed to export data");
    }
  };

  const generatePaymentReport = () => {
    try {
      const reportData = [
        { "Category": "Pending Direct Commissions", "Count": stats.direct.count, "Amount": `₹${stats.direct.total.toLocaleString()}` },
        { "Category": "Pending Network Commissions", "Count": stats.network.count, "Amount": `₹${stats.network.total.toLocaleString()}` },
        { "Category": "Total Pending", "Count": stats.direct.count + stats.network.count, "Amount": `₹${(stats.direct.total + stats.network.total).toLocaleString()}` },
        { "Category": "", "Count": "", "Amount": "" },
        { "Category": "Paid Commissions (Last 100)", "Count": stats.paid.count, "Amount": `₹${stats.paid.total.toLocaleString()}` }
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(reportData);
      XLSX.utils.book_append_sheet(wb, ws, "Payment Report");

      const fileName = `payment_report_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Payment report generated!");
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading commissions...</p>
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
              <DollarSign className="h-8 w-8" />
              Commission Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage pending and paid commission payments
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={generatePaymentReport}>
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
            <Button onClick={() => navigate("/superadmin/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Pending Direct</p>
              <p className="text-2xl font-bold text-yellow-500">
                ₹{stats.direct.total.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{stats.direct.count} payments</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Pending Network</p>
              <p className="text-2xl font-bold text-yellow-500">
                ₹{stats.network.total.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{stats.network.count} payments</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Pending</p>
              <p className="text-2xl font-bold text-orange-500">
                ₹{(stats.direct.total + stats.network.total).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{stats.direct.count + stats.network.count} payments</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Paid (Last 100)</p>
              <p className="text-2xl font-bold text-green-500">
                ₹{stats.paid.total.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{stats.paid.count} payments</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="direct" onValueChange={(value) => setCurrentTab(value as "direct" | "network")}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="direct">
              Pending Direct ({stats.direct.count})
            </TabsTrigger>
            <TabsTrigger value="network">
              Pending Network ({stats.network.count})
            </TabsTrigger>
            <TabsTrigger value="paid">
              Paid History ({stats.paid.count})
            </TabsTrigger>
            <TabsTrigger value="reports">
              Reports
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Pending Direct Commissions */}
          <TabsContent value="direct" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pending Direct Commissions</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Total: ₹{stats.direct.total.toLocaleString()} | Oldest: {stats.direct.oldestDays} days
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportToExcel("direct")}
                      disabled={pendingDirectCommissions.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setCurrentTab("direct");
                        setMarkAsPaidModal(true);
                      }}
                      disabled={selectedDirect.length === 0}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark Selected as Paid ({selectedDirect.length})
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {pendingDirectCommissions.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No pending direct commissions</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedDirect.length === pendingDirectCommissions.length}
                              onCheckedChange={(checked) => handleSelectAll("direct", checked as boolean)}
                            />
                          </TableHead>
                          <TableHead>Helper</TableHead>
                          <TableHead>Store Owner</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Plan Amount</TableHead>
                          <TableHead>Commission</TableHead>
                          <TableHead>Earned Date</TableHead>
                          <TableHead>Days Pending</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingDirectCommissions.map((commission) => (
                          <TableRow key={commission.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedDirect.includes(commission.id)}
                                onCheckedChange={(checked) => handleSelectOne("direct", commission.id, checked as boolean)}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-semibold">{commission.helper_name}</p>
                                <p className="text-sm text-muted-foreground">{commission.helper_id}</p>
                              </div>
                            </TableCell>
                            <TableCell>{commission.store_owner_name}</TableCell>
                            <TableCell>{commission.plan_name}</TableCell>
                            <TableCell>₹{commission.plan_amount.toLocaleString()}</TableCell>
                            <TableCell className="font-bold text-green-500">
                              ₹{commission.commission_amount.toLocaleString()}
                            </TableCell>
                            <TableCell>{format(new Date(commission.earned_date), "PP")}</TableCell>
                            <TableCell>
                              <Badge variant={commission.days_pending > 30 ? "destructive" : "secondary"}>
                                {commission.days_pending} days
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Pending Network Commissions */}
          <TabsContent value="network" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pending Network Commissions</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Total: ₹{stats.network.total.toLocaleString()} | Oldest: {stats.network.oldestDays} days
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportToExcel("network")}
                      disabled={pendingNetworkCommissions.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setCurrentTab("network");
                        setMarkAsPaidModal(true);
                      }}
                      disabled={selectedNetwork.length === 0}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark Selected as Paid ({selectedNetwork.length})
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {pendingNetworkCommissions.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No pending network commissions</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedNetwork.length === pendingNetworkCommissions.length}
                              onCheckedChange={(checked) => handleSelectAll("network", checked as boolean)}
                            />
                          </TableHead>
                          <TableHead>Helper</TableHead>
                          <TableHead>Store Owner</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Plan Amount</TableHead>
                          <TableHead>Commission</TableHead>
                          <TableHead>Earned Date</TableHead>
                          <TableHead>Days Pending</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingNetworkCommissions.map((commission) => (
                          <TableRow key={commission.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedNetwork.includes(commission.id)}
                                onCheckedChange={(checked) => handleSelectOne("network", commission.id, checked as boolean)}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-semibold">{commission.helper_name}</p>
                                <p className="text-sm text-muted-foreground">{commission.helper_id}</p>
                              </div>
                            </TableCell>
                            <TableCell>{commission.store_owner_name}</TableCell>
                            <TableCell>{commission.plan_name}</TableCell>
                            <TableCell>₹{commission.plan_amount.toLocaleString()}</TableCell>
                            <TableCell className="font-bold text-blue-500">
                              ₹{commission.commission_amount.toLocaleString()}
                            </TableCell>
                            <TableCell>{format(new Date(commission.earned_date), "PP")}</TableCell>
                            <TableCell>
                              <Badge variant={commission.days_pending > 30 ? "destructive" : "secondary"}>
                                {commission.days_pending} days
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Paid Commissions */}
          <TabsContent value="paid" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Paid Commissions (Last 100)</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToExcel("paid")}
                    disabled={paidCommissions.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {paidCommissions.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No paid commissions yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Helper</TableHead>
                          <TableHead>Store Owner</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Commission</TableHead>
                          <TableHead>Earned Date</TableHead>
                          <TableHead>Payment Date</TableHead>
                          <TableHead>Reference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paidCommissions.map((commission) => (
                          <TableRow key={commission.id}>
                            <TableCell>
                              <div>
                                <p className="font-semibold">{commission.helper_name}</p>
                                <p className="text-sm text-muted-foreground">{commission.helper_id}</p>
                              </div>
                            </TableCell>
                            <TableCell>{commission.store_owner_name}</TableCell>
                            <TableCell>{commission.plan_name}</TableCell>
                            <TableCell className="font-bold text-green-500">
                              ₹{commission.commission_amount.toLocaleString()}
                            </TableCell>
                            <TableCell>{format(new Date(commission.earned_date), "PP")}</TableCell>
                            <TableCell>
                              {commission.payment_date && format(new Date(commission.payment_date), "PP")}
                            </TableCell>
                            <TableCell className="text-sm">{commission.payment_reference}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Reports */}
          <TabsContent value="reports" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Commissions Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-muted rounded">
                    <div>
                      <p className="text-sm text-muted-foreground">Direct Commissions</p>
                      <p className="text-2xl font-bold text-green-500">₹{stats.direct.total.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{stats.direct.count} payments</p>
                    </div>
                    <Clock className="h-8 w-8 text-yellow-500" />
                  </div>
                  <div className="flex justify-between items-center p-4 bg-muted rounded">
                    <div>
                      <p className="text-sm text-muted-foreground">Network Commissions</p>
                      <p className="text-2xl font-bold text-blue-500">₹{stats.network.total.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{stats.network.count} payments</p>
                    </div>
                    <Clock className="h-8 w-8 text-yellow-500" />
                  </div>
                  <div className="flex justify-between items-center p-4 bg-primary/10 rounded">
                    <div>
                      <p className="text-sm font-semibold">Total Pending</p>
                      <p className="text-3xl font-bold text-orange-500">
                        ₹{(stats.direct.total + stats.network.total).toLocaleString()}
                      </p>
                      <p className="text-xs">{stats.direct.count + stats.network.count} payments</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payment Analytics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Oldest Pending (Direct)</span>
                      <span className="font-semibold">{stats.direct.oldestDays} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Oldest Pending (Network)</span>
                      <span className="font-semibold">{stats.network.oldestDays} days</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Total Paid (Last 100)</span>
                      <span className="font-semibold text-green-500">₹{stats.paid.total.toLocaleString()}</span>
                    </div>
                  </div>
                  <Button className="w-full mt-4" onClick={generatePaymentReport}>
                    <FileText className="h-4 w-4 mr-2" />
                    Download Full Report
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Mark as Paid Modal */}
      <Dialog open={markAsPaidModal} onOpenChange={setMarkAsPaidModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Commissions as Paid</DialogTitle>
            <DialogDescription>
              Mark {currentTab === "direct" ? selectedDirect.length : selectedNetwork.length} selected commission(s) as paid
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={markAsPaidForm.payment_date}
                onChange={(e) => setMarkAsPaidForm({ ...markAsPaidForm, payment_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Reference / Transaction ID *</Label>
              <Input
                value={markAsPaidForm.payment_reference}
                onChange={(e) => setMarkAsPaidForm({ ...markAsPaidForm, payment_reference: e.target.value })}
                placeholder="Enter transaction ID or reference number"
              />
            </div>
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-3">
              <p className="text-sm text-green-800 dark:text-green-200">
                <CheckCircle className="inline w-4 h-4 mr-2" />
                This will update the commission status to "Paid" and record the payment details.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkAsPaidModal(false)}>Cancel</Button>
            <Button onClick={handleMarkAsPaid}>Mark as Paid</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
