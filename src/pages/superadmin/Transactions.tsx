import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  Download,
  Eye,
  RefreshCw,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import SuperAdminLayout from "@/components/superadmin/SuperAdminLayout";

interface Transaction {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount: number;
  gst_amount: number | null;
  total_amount: number;
  payment_gateway: string;
  payment_id: string | null;
  payment_method: string | null;
  status: string;
  invoice_number: string | null;
  created_at: string;
  profiles?: {
    email: string;
    full_name: string | null;
  };
  stores?: {
    name: string;
    slug: string;
  }[];
}

interface RevenueStats {
  totalRevenue: number;
  successfulTransactions: number;
  successAmount: number;
  successRate: number;
  failedTransactions: number;
  failedAmount: number;
  pendingTransactions: number;
  pendingAmount: number;
}

export default function Transactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<RevenueStats>({
    totalRevenue: 0,
    successfulTransactions: 0,
    successAmount: 0,
    successRate: 0,
    failedTransactions: 0,
    failedAmount: 0,
    pendingTransactions: 0,
    pendingAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [gatewayFilter, setGatewayFilter] = useState("all");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    // Check super admin auth
    const session = sessionStorage.getItem('superadmin_session');
    if (!session) {
      navigate('/superadmin/login');
      return;
    }
    fetchTransactions();
  }, [navigate]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          profiles!inner (email, full_name),
          stores!left (name, slug)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const formattedTransactions = (data || []).map((t: any) => ({
        ...t,
        profiles: Array.isArray(t.profiles) ? t.profiles[0] : t.profiles,
      }));

      setTransactions(formattedTransactions);

      // Calculate stats
      const successful = formattedTransactions.filter((t) => t.status === "success");
      const failed = formattedTransactions.filter((t) => t.status === "failed");
      const pending = formattedTransactions.filter((t) => t.status === "pending");

      setStats({
        totalRevenue: successful.reduce((sum, t) => sum + t.total_amount, 0),
        successfulTransactions: successful.length,
        successAmount: successful.reduce((sum, t) => sum + t.total_amount, 0),
        successRate: formattedTransactions.length > 0 ? (successful.length / formattedTransactions.length) * 100 : 0,
        failedTransactions: failed.length,
        failedAmount: failed.reduce((sum, t) => sum + t.total_amount, 0),
        pendingTransactions: pending.length,
        pendingAmount: pending.reduce((sum, t) => sum + t.total_amount, 0),
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

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.profiles?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesGateway = gatewayFilter === "all" || t.payment_gateway === gatewayFilter;

    return matchesSearch && matchesStatus && matchesGateway;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500">Success</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "pending":
        return <Badge variant="outline" className="border-orange-500 text-orange-500">Pending</Badge>;
      case "refunded":
        return <Badge variant="secondary">Refunded</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleExport = () => {
    const csvData = filteredTransactions.map((t) => ({
      Date: new Date(t.created_at).toLocaleDateString(),
      "Transaction ID": t.id,
      User: t.profiles?.email || "",
      Amount: t.amount,
      GST: t.gst_amount || 0,
      Total: t.total_amount,
      Gateway: t.payment_gateway,
      Status: t.status,
      Invoice: t.invoice_number || "",
    }));

    const csv = [
      Object.keys(csvData[0]).join(","),
      ...csvData.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();

    toast({
      title: "Export Successful",
      description: `Exported ${filteredTransactions.length} transactions`,
    });
  };

  return (
    <SuperAdminLayout>
      <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Transactions & Revenue</h1>
          <p className="text-sm md:text-base text-muted-foreground">Monitor all platform transactions</p>
        </div>
        <Button onClick={handleExport} className="w-full sm:w-auto">
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              {stats.successRate.toFixed(1)}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Successful Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold">{stats.successfulTransactions}</div>
            <p className="text-xs md:text-sm text-muted-foreground">
              {formatCurrency(stats.successAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold">{stats.failedTransactions}</div>
            <p className="text-xs md:text-sm text-muted-foreground">
              {formatCurrency(stats.failedAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold">{stats.pendingTransactions}</div>
            <p className="text-xs md:text-sm text-muted-foreground">
              {formatCurrency(stats.pendingAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-lg border space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            placeholder="Search transaction ID or email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select value={gatewayFilter} onValueChange={setGatewayFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Gateways" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Gateways</SelectItem>
              <SelectItem value="razorpay">Razorpay</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchTransactions}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Date & Time</TableHead>
                  <TableHead className="min-w-[200px]">User</TableHead>
                  <TableHead className="min-w-[150px]">Amount</TableHead>
                  <TableHead className="min-w-[120px]">Gateway</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="text-right min-w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading transactions...
                    </TableCell>
                  </TableRow>
                ) : filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">
                            {new Date(transaction.created_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(transaction.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{transaction.profiles?.email}</div>
                          {transaction.stores?.[0] && (
                            <div className="text-xs text-muted-foreground">
                              {transaction.stores[0].name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{formatCurrency(transaction.amount)}</div>
                          {transaction.gst_amount && (
                            <div className="text-xs text-muted-foreground">
                              +GST: {formatCurrency(transaction.gst_amount)}
                            </div>
                          )}
                          <div className="font-semibold">{formatCurrency(transaction.total_amount)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium capitalize">{transaction.payment_gateway}</div>
                          {transaction.payment_method && (
                            <div className="text-xs text-muted-foreground capitalize">
                              {transaction.payment_method}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedTransaction(transaction);
                            setShowDetailModal(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>

          {selectedTransaction && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="customer">Customer</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Transaction ID:</div>
                    <div className="font-mono text-xs">{selectedTransaction.id}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Date:</div>
                    <div>{new Date(selectedTransaction.created_at).toLocaleString()}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Status:</div>
                    <div>{getStatusBadge(selectedTransaction.status)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Amount:</div>
                    <div>{formatCurrency(selectedTransaction.amount)}</div>
                  </div>
                  {selectedTransaction.gst_amount && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">GST (18%):</div>
                      <div>{formatCurrency(selectedTransaction.gst_amount)}</div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Total:</div>
                    <div className="font-bold">{formatCurrency(selectedTransaction.total_amount)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Payment Gateway:</div>
                    <div className="capitalize">{selectedTransaction.payment_gateway}</div>
                  </div>
                  {selectedTransaction.payment_id && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Payment ID:</div>
                      <div className="font-mono text-xs">{selectedTransaction.payment_id}</div>
                    </div>
                  )}
                  {selectedTransaction.invoice_number && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Invoice Number:</div>
                      <div>{selectedTransaction.invoice_number}</div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="customer" className="space-y-4 mt-4">
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Email:</div>
                    <div>{selectedTransaction.profiles?.email}</div>
                  </div>
                  {selectedTransaction.profiles?.full_name && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Name:</div>
                      <div>{selectedTransaction.profiles.full_name}</div>
                    </div>
                  )}
                  {selectedTransaction.stores?.[0] && (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-muted-foreground">Store:</div>
                        <div>{selectedTransaction.stores[0].name}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-muted-foreground">Store Slug:</div>
                        <div>{selectedTransaction.stores[0].slug}</div>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </SuperAdminLayout>
  );
}
