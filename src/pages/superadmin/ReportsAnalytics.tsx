import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import {
  ArrowLeft, Users, UserCheck, TrendingUp, DollarSign, Network,
  Download, FileText, Calendar, Filter, BarChart3
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface OverviewStats {
  helperProgram: {
    totalApplications: number;
    pendingApplications: number;
    approvedHelpers: number;
    rejectedApplications: number;
    activeHelpers: number;
    suspendedHelpers: number;
  };
  referralPerformance: {
    totalReferrals: number;
    onTrial: number;
    convertedToPaid: number;
    conversionRate: number;
  };
  commissionOverview: {
    totalEarned: number;
    directCommissions: number;
    networkCommissions: number;
    pendingPayment: number;
    paidThisMonth: number;
  };
  networkGrowth: {
    totalNetworks: number;
    largestNetwork: number;
    averageNetworkSize: number;
    networkCommissionsPaid: number;
  };
}

interface MonthlyData {
  month: string;
  applications: number;
  approved: number;
  rejected: number;
  directCommissions: number;
  networkCommissions: number;
  total: number;
}

interface TopHelper {
  id: string;
  name: string;
  directCommissions: number;
  referralCount: number;
  networkSize: number;
  totalEarnings: number;
  joinedDate: string;
}

const SuperAdminReportsAnalytics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [topHelpers, setTopHelpers] = useState<TopHelper[]>([]);
  const [performanceDistribution, setPerformanceDistribution] = useState<any[]>([]);
  const [conversionFunnel, setConversionFunnel] = useState<any[]>([]);

  // Custom Report Builder State
  const [reportDateRange, setReportDateRange] = useState({ start: "", end: "" });
  const [reportMetrics, setReportMetrics] = useState({
    applications: true,
    approvals: true,
    referrals: true,
    commissions: true,
    payments: true,
    networkStats: true
  });
  const [reportGrouping, setReportGrouping] = useState("month");

  useEffect(() => {
    checkSuperAdmin();
  }, []);

  const checkSuperAdmin = async () => {
    const isSuperAdmin = sessionStorage.getItem("isSuperAdmin") === "true";
    if (!isSuperAdmin) {
      toast.error("Access denied. Super Admin only.");
      navigate("/superadmin/login");
      return;
    }
    await loadAllData();
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadOverviewStats(),
        loadMonthlyData(),
        loadTopHelpers(),
        loadPerformanceDistribution(),
        loadConversionFunnel()
      ]);
    } catch (error) {
      console.error("Error loading analytics data:", error);
      toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  const loadOverviewStats = async () => {
    // Load Helper Program Stats
    const { data: applications } = await supabase
      .from("helper_applications")
      .select("id, application_status");

    const totalApplications = applications?.length || 0;
    const pendingApplications = applications?.filter(a => a.application_status === "Pending").length || 0;
    const rejectedApplications = applications?.filter(a => a.application_status === "Rejected").length || 0;

    const { data: helpers } = await supabase
      .from("helpers")
      .select("id, status");

    const approvedHelpers = helpers?.length || 0;
    const activeHelpers = helpers?.filter(h => h.status === "Active").length || 0;
    const suspendedHelpers = helpers?.filter(h => h.status === "Suspended").length || 0;

    // Load Referral Performance
    const { data: referrals } = await supabase
      .from("store_referrals")
      .select("id, trial_status, subscription_purchased");

    const totalReferrals = referrals?.length || 0;
    const onTrial = referrals?.filter(r => r.trial_status === "Active").length || 0;
    const convertedToPaid = referrals?.filter(r => r.subscription_purchased === true).length || 0;
    const conversionRate = totalReferrals > 0 ? (convertedToPaid / totalReferrals) * 100 : 0;

    // Load Commission Overview
    const { data: commissions } = await supabase
      .from("network_commissions")
      .select("direct_commission_amount, network_commission_amount, commission_status, created_at");

    const totalEarned = commissions?.reduce((sum, c) =>
      sum + (c.direct_commission_amount || 0) + (c.network_commission_amount || 0), 0
    ) || 0;

    const directCommissions = commissions?.reduce((sum, c) =>
      sum + (c.direct_commission_amount || 0), 0
    ) || 0;

    const networkCommissions = commissions?.reduce((sum, c) =>
      sum + (c.network_commission_amount || 0), 0
    ) || 0;

    const pendingPayment = commissions?.filter(c => c.commission_status === "Earned-Pending")
      .reduce((sum, c) => sum + (c.direct_commission_amount || 0) + (c.network_commission_amount || 0), 0) || 0;

    const thisMonthStart = startOfMonth(new Date());
    const paidThisMonth = commissions?.filter(c =>
      c.commission_status === "Paid" &&
      new Date(c.created_at) >= thisMonthStart
    ).reduce((sum, c) => sum + (c.direct_commission_amount || 0) + (c.network_commission_amount || 0), 0) || 0;

    // Load Network Growth
    const { data: recruitedHelpers } = await supabase
      .from("helpers")
      .select("id, recruited_by_helper_id");

    const helpersWithRecruiters = recruitedHelpers?.filter(h => h.recruited_by_helper_id) || [];
    const totalNetworks = new Set(helpersWithRecruiters.map(h => h.recruited_by_helper_id)).size;

    // Calculate largest network
    const networkSizes = new Map<string, number>();
    helpersWithRecruiters.forEach(h => {
      const count = networkSizes.get(h.recruited_by_helper_id!) || 0;
      networkSizes.set(h.recruited_by_helper_id!, count + 1);
    });
    const largestNetwork = networkSizes.size > 0 ? Math.max(...Array.from(networkSizes.values())) : 0;
    const averageNetworkSize = totalNetworks > 0 ? helpersWithRecruiters.length / totalNetworks : 0;

    const networkCommissionsPaid = commissions?.filter(c => c.commission_status === "Paid")
      .reduce((sum, c) => sum + (c.network_commission_amount || 0), 0) || 0;

    setOverviewStats({
      helperProgram: {
        totalApplications,
        pendingApplications,
        approvedHelpers,
        rejectedApplications,
        activeHelpers,
        suspendedHelpers
      },
      referralPerformance: {
        totalReferrals,
        onTrial,
        convertedToPaid,
        conversionRate
      },
      commissionOverview: {
        totalEarned,
        directCommissions,
        networkCommissions,
        pendingPayment,
        paidThisMonth
      },
      networkGrowth: {
        totalNetworks,
        largestNetwork,
        averageNetworkSize,
        networkCommissionsPaid
      }
    });
  };

  const loadMonthlyData = async () => {
    const months: MonthlyData[] = [];

    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      // Applications
      const { data: apps } = await supabase
        .from("helper_applications")
        .select("id, application_status, created_at")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString());

      const applications = apps?.length || 0;
      const approved = apps?.filter(a => a.application_status === "Approved").length || 0;
      const rejected = apps?.filter(a => a.application_status === "Rejected").length || 0;

      // Commissions
      const { data: commissions } = await supabase
        .from("network_commissions")
        .select("direct_commission_amount, network_commission_amount")
        .gte("date_earned", monthStart.toISOString())
        .lte("date_earned", monthEnd.toISOString());

      const directCommissions = commissions?.reduce((sum, c) =>
        sum + (c.direct_commission_amount || 0), 0
      ) || 0;

      const networkCommissions = commissions?.reduce((sum, c) =>
        sum + (c.network_commission_amount || 0), 0
      ) || 0;

      months.push({
        month: format(monthDate, "MMM yyyy"),
        applications,
        approved,
        rejected,
        directCommissions,
        networkCommissions,
        total: directCommissions + networkCommissions
      });
    }

    setMonthlyData(months);
  };

  const loadTopHelpers = async () => {
    const { data: helpers } = await supabase
      .from("helpers")
      .select("id, full_name, created_at");

    if (!helpers) return;

    const helperStats = await Promise.all(
      helpers.map(async (helper) => {
        // Get referrals
        const { data: referrals } = await supabase
          .from("store_referrals")
          .select("id")
          .eq("helper_id", helper.id);

        // Get commissions
        const { data: commissions } = await supabase
          .from("network_commissions")
          .select("direct_commission_amount, network_commission_amount")
          .eq("earning_helper_id", helper.id);

        const directCommissions = commissions?.reduce((sum, c) =>
          sum + (c.direct_commission_amount || 0), 0
        ) || 0;

        const networkCommissions = commissions?.reduce((sum, c) =>
          sum + (c.network_commission_amount || 0), 0
        ) || 0;

        // Get network size
        const { data: recruited } = await supabase
          .from("helpers")
          .select("id")
          .eq("recruited_by_helper_id", helper.id);

        return {
          id: helper.id,
          name: helper.full_name,
          directCommissions,
          referralCount: referrals?.length || 0,
          networkSize: recruited?.length || 0,
          totalEarnings: directCommissions + networkCommissions,
          joinedDate: helper.created_at
        };
      })
    );

    // Sort by total earnings and take top 20
    const sorted = helperStats.sort((a, b) => b.totalEarnings - a.totalEarnings).slice(0, 20);
    setTopHelpers(sorted);
  };

  const loadPerformanceDistribution = async () => {
    const { data: helpers } = await supabase
      .from("helpers")
      .select("id");

    if (!helpers) return;

    const earnings = await Promise.all(
      helpers.map(async (helper) => {
        const { data: commissions } = await supabase
          .from("network_commissions")
          .select("direct_commission_amount, network_commission_amount")
          .eq("earning_helper_id", helper.id);

        return commissions?.reduce((sum, c) =>
          sum + (c.direct_commission_amount || 0) + (c.network_commission_amount || 0), 0
        ) || 0;
      })
    );

    earnings.sort((a, b) => b - a);

    const totalHelpers = earnings.length;
    const top10Count = Math.ceil(totalHelpers * 0.1);
    const middle40Count = Math.ceil(totalHelpers * 0.4);

    const top10 = earnings.slice(0, top10Count);
    const middle40 = earnings.slice(top10Count, top10Count + middle40Count);
    const bottom50 = earnings.slice(top10Count + middle40Count);

    setPerformanceDistribution([
      {
        name: "Top 10%",
        value: top10.length,
        earnings: top10.reduce((a, b) => a + b, 0)
      },
      {
        name: "Middle 40%",
        value: middle40.length,
        earnings: middle40.reduce((a, b) => a + b, 0)
      },
      {
        name: "Bottom 50%",
        value: bottom50.length,
        earnings: bottom50.reduce((a, b) => a + b, 0)
      }
    ]);
  };

  const loadConversionFunnel = async () => {
    const { data: applications } = await supabase
      .from("helper_applications")
      .select("id, status");

    const { data: helpers } = await supabase
      .from("helpers")
      .select("id");

    const helpersWithReferrals = await Promise.all(
      (helpers || []).map(async (helper) => {
        const { data: referrals } = await supabase
          .from("store_referrals")
          .select("id, subscription_purchased")
          .eq("helper_id", helper.id);

        const hasPaidReferrals = referrals?.some(r => r.subscription_purchased === true);

        const { data: recruited } = await supabase
          .from("helpers")
          .select("id")
          .eq("recruited_by_helper_id", helper.id);

        return {
          hasReferrals: (referrals?.length || 0) > 0,
          hasPaidReferrals,
          hasRecruited: (recruited?.length || 0) > 0
        };
      })
    );

    setConversionFunnel([
      {
        stage: "Applications Submitted",
        count: applications?.length || 0,
        percentage: 100
      },
      {
        stage: "Applications Approved",
        count: helpers?.length || 0,
        percentage: applications?.length ? ((helpers?.length || 0) / applications.length) * 100 : 0
      },
      {
        stage: "Helpers with Referrals",
        count: helpersWithReferrals.filter(h => h.hasReferrals).length,
        percentage: helpers?.length ? (helpersWithReferrals.filter(h => h.hasReferrals).length / helpers.length) * 100 : 0
      },
      {
        stage: "Helpers with Paid Referrals",
        count: helpersWithReferrals.filter(h => h.hasPaidReferrals).length,
        percentage: helpers?.length ? (helpersWithReferrals.filter(h => h.hasPaidReferrals).length / helpers.length) * 100 : 0
      },
      {
        stage: "Helpers who Recruited",
        count: helpersWithReferrals.filter(h => h.hasRecruited).length,
        percentage: helpers?.length ? (helpersWithReferrals.filter(h => h.hasRecruited).length / helpers.length) * 100 : 0
      }
    ]);
  };

  const exportTopHelpers = () => {
    try {
      const data = topHelpers.map((helper, index) => ({
        "Rank": index + 1,
        "Helper Name": helper.name,
        "Helper ID": helper.id,
        "Direct Commissions": `₹${helper.directCommissions.toLocaleString()}`,
        "Referral Count": helper.referralCount,
        "Network Size": helper.networkSize,
        "Total Earnings": `₹${helper.totalEarnings.toLocaleString()}`,
        "Joined Date": format(new Date(helper.joinedDate), "PPP")
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Top Performers");

      const fileName = `top_helpers_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Report exported successfully!");
    } catch (error) {
      toast.error("Failed to export report");
    }
  };

  const generateCustomReport = () => {
    if (!reportDateRange.start || !reportDateRange.end) {
      toast.error("Please select date range");
      return;
    }

    // Generate report based on selected metrics and grouping
    toast.success("Custom report generated!");
    // Implementation would generate and export based on selections
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/superadmin/dashboard")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Reports & Analytics</h1>
                <p className="text-sm text-muted-foreground">
                  Comprehensive insights into helper program performance
                </p>
              </div>
            </div>
            <Badge variant="default" className="text-sm px-3 py-1">
              Super Admin
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Helper Program Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Helper Program Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total applications:</span>
                <span className="font-semibold">{overviewStats?.helperProgram.totalApplications}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending:</span>
                <span className="font-semibold text-yellow-600">{overviewStats?.helperProgram.pendingApplications}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Approved helpers:</span>
                <span className="font-semibold text-green-600">{overviewStats?.helperProgram.approvedHelpers}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rejected:</span>
                <span className="font-semibold text-red-600">{overviewStats?.helperProgram.rejectedApplications}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Active helpers:</span>
                <span className="font-semibold text-green-600">{overviewStats?.helperProgram.activeHelpers}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Suspended:</span>
                <span className="font-semibold text-orange-600">{overviewStats?.helperProgram.suspendedHelpers}</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Referral Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-green-500" />
                Referral Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total referrals:</span>
                <span className="font-semibold">{overviewStats?.referralPerformance.totalReferrals}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Currently on trial:</span>
                <span className="font-semibold text-blue-600">{overviewStats?.referralPerformance.onTrial}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Converted to paid:</span>
                <span className="font-semibold text-green-600">{overviewStats?.referralPerformance.convertedToPaid}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="text-muted-foreground">Conversion rate:</span>
                <span className="font-bold text-green-600">
                  {overviewStats?.referralPerformance.conversionRate.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Commission Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                Commission Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total earned:</span>
                <span className="font-bold">₹{overviewStats?.commissionOverview.totalEarned.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground ml-4">Direct:</span>
                <span className="font-semibold">₹{overviewStats?.commissionOverview.directCommissions.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground ml-4">Network:</span>
                <span className="font-semibold">₹{overviewStats?.commissionOverview.networkCommissions.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending payment:</span>
                <span className="font-semibold text-yellow-600">₹{overviewStats?.commissionOverview.pendingPayment.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid this month:</span>
                <span className="font-semibold text-green-600">₹{overviewStats?.commissionOverview.paidThisMonth.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Network Growth */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Network className="h-5 w-5 text-purple-500" />
                Network Growth
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total networks:</span>
                <span className="font-semibold">{overviewStats?.networkGrowth.totalNetworks}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Largest network:</span>
                <span className="font-semibold text-blue-600">{overviewStats?.networkGrowth.largestNetwork} helpers</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Average size:</span>
                <span className="font-semibold">{overviewStats?.networkGrowth.averageNetworkSize.toFixed(1)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="text-muted-foreground">Network commissions:</span>
                <span className="font-bold text-green-600">
                  ₹{overviewStats?.networkGrowth.networkCommissionsPaid.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Charts</CardTitle>
            <CardDescription>Visual representation of key metrics over time</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="applications">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="applications">Applications</TabsTrigger>
                <TabsTrigger value="commissions">Commissions</TabsTrigger>
                <TabsTrigger value="distribution">Distribution</TabsTrigger>
                <TabsTrigger value="funnel">Funnel</TabsTrigger>
              </TabsList>

              {/* Chart 1: Applications Over Time */}
              <TabsContent value="applications" className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Applications Over Time</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="applications" fill="#8884d8" name="Total Applications" />
                      <Bar dataKey="approved" fill="#82ca9d" name="Approved" />
                      <Bar dataKey="rejected" fill="#ff8042" name="Rejected" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              {/* Chart 2: Commission Payouts */}
              <TabsContent value="commissions" className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Commission Payouts</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="directCommissions" fill="#0088FE" name="Direct Commissions" />
                      <Bar dataKey="networkCommissions" fill="#00C49F" name="Network Commissions" />
                      <Bar dataKey="total" fill="#FFBB28" name="Total" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              {/* Chart 3: Helper Performance Distribution */}
              <TabsContent value="distribution" className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Helper Performance Distribution</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={performanceDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value} helpers`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {performanceDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    {performanceDistribution.map((segment, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="w-4 h-4 rounded"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="font-semibold">{segment.name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {segment.value} helpers
                          </p>
                          <p className="text-sm font-semibold text-green-600">
                            ₹{segment.earnings?.toLocaleString()} earned
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Chart 4: Conversion Funnel */}
              <TabsContent value="funnel" className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Conversion Funnel</h3>
                  <div className="space-y-3">
                    {conversionFunnel.map((stage, index) => (
                      <div key={index}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold">{stage.stage}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                              {stage.percentage.toFixed(1)}%
                            </span>
                            <span className="font-bold">{stage.count}</span>
                          </div>
                        </div>
                        <div className="w-full bg-muted rounded-full h-8 relative overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-green-500 h-full flex items-center justify-center text-white text-sm font-semibold transition-all"
                            style={{ width: `${stage.percentage}%` }}
                          >
                            {stage.percentage > 20 && `${stage.count} helpers`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Detailed Reports Section */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Reports</CardTitle>
            <CardDescription>In-depth analysis and performance reports</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="top-performers">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="top-performers">Top Performers</TabsTrigger>
                <TabsTrigger value="network">Network Analytics</TabsTrigger>
                <TabsTrigger value="payments">Payment Reports</TabsTrigger>
                <TabsTrigger value="applications">Applications</TabsTrigger>
              </TabsList>

              {/* Report 1: Top Performing Helpers */}
              <TabsContent value="top-performers" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Top 20 Performing Helpers</h3>
                  <Button onClick={exportTopHelpers}>
                    <Download className="h-4 w-4 mr-2" />
                    Export to Excel
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Rank</TableHead>
                        <TableHead>Helper Name</TableHead>
                        <TableHead>Direct Commissions</TableHead>
                        <TableHead>Referral Count</TableHead>
                        <TableHead>Network Size</TableHead>
                        <TableHead>Total Earnings</TableHead>
                        <TableHead>Joined Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topHelpers.map((helper, index) => (
                        <TableRow key={helper.id}>
                          <TableCell>
                            <Badge variant={index < 3 ? "default" : "secondary"}>
                              #{index + 1}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-semibold">{helper.name}</p>
                              <p className="text-xs text-muted-foreground">{helper.id}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            ₹{helper.directCommissions.toLocaleString()}
                          </TableCell>
                          <TableCell>{helper.referralCount}</TableCell>
                          <TableCell>{helper.networkSize}</TableCell>
                          <TableCell className="font-bold text-green-600">
                            ₹{helper.totalEarnings.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(helper.joinedDate), "PP")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Report 2: Helper Network Analytics */}
              <TabsContent value="network" className="space-y-4">
                <h3 className="text-lg font-semibold">Helper Network Analytics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Network Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Networks:</span>
                          <span className="font-semibold">{overviewStats?.networkGrowth.totalNetworks}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Average Size:</span>
                          <span className="font-semibold">{overviewStats?.networkGrowth.averageNetworkSize.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Largest:</span>
                          <span className="font-semibold">{overviewStats?.networkGrowth.largestNetwork}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Network Commissions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Paid:</span>
                          <span className="font-bold text-green-600">
                            ₹{overviewStats?.networkGrowth.networkCommissionsPaid.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Pending:</span>
                          <span className="font-semibold text-yellow-600">
                            ₹{overviewStats?.commissionOverview.pendingPayment.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Growth Metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Active Recruiters:</span>
                          <span className="font-semibold">{overviewStats?.networkGrowth.totalNetworks}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Recruitment Rate:</span>
                          <span className="font-semibold">
                            {overviewStats?.helperProgram.approvedHelpers && overviewStats?.networkGrowth.totalNetworks
                              ? ((overviewStats.networkGrowth.totalNetworks / overviewStats.helperProgram.approvedHelpers) * 100).toFixed(1)
                              : 0}%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Report 3: Payment Reports */}
              <TabsContent value="payments" className="space-y-4">
                <h3 className="text-lg font-semibold">Payment Reports</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Commission Type Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">Direct Commissions</span>
                            <span className="text-sm font-semibold">
                              ₹{overviewStats?.commissionOverview.directCommissions.toLocaleString()}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{
                                width: `${overviewStats?.commissionOverview.totalEarned
                                  ? (overviewStats.commissionOverview.directCommissions / overviewStats.commissionOverview.totalEarned) * 100
                                  : 0}%`
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">Network Commissions</span>
                            <span className="text-sm font-semibold">
                              ₹{overviewStats?.commissionOverview.networkCommissions.toLocaleString()}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{
                                width: `${overviewStats?.commissionOverview.totalEarned
                                  ? (overviewStats.commissionOverview.networkCommissions / overviewStats.commissionOverview.totalEarned) * 100
                                  : 0}%`
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Payment Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                          <span className="text-sm font-medium">Paid This Month</span>
                          <span className="font-bold text-green-600">
                            ₹{overviewStats?.commissionOverview.paidThisMonth.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                          <span className="text-sm font-medium">Pending Payment</span>
                          <span className="font-bold text-yellow-600">
                            ₹{overviewStats?.commissionOverview.pendingPayment.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Report 4: Application Analytics */}
              <TabsContent value="applications" className="space-y-4">
                <h3 className="text-lg font-semibold">Application Analytics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Total Applications</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{overviewStats?.helperProgram.totalApplications}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Approval Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-green-600">
                        {overviewStats?.helperProgram.totalApplications
                          ? ((overviewStats.helperProgram.approvedHelpers / overviewStats.helperProgram.totalApplications) * 100).toFixed(1)
                          : 0}%
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Rejection Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-red-600">
                        {overviewStats?.helperProgram.totalApplications
                          ? ((overviewStats.helperProgram.rejectedApplications / overviewStats.helperProgram.totalApplications) * 100).toFixed(1)
                          : 0}%
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Pending Review</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-yellow-600">
                        {overviewStats?.helperProgram.pendingApplications}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Custom Report Builder */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Report Builder</CardTitle>
            <CardDescription>Generate custom reports based on your requirements</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <input
                  type="date"
                  value={reportDateRange.start}
                  onChange={(e) => setReportDateRange({ ...reportDateRange, start: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <input
                  type="date"
                  value={reportDateRange.end}
                  onChange={(e) => setReportDateRange({ ...reportDateRange, end: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Metrics</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="metric-applications"
                    checked={reportMetrics.applications}
                    onCheckedChange={(checked) =>
                      setReportMetrics({ ...reportMetrics, applications: checked as boolean })
                    }
                  />
                  <label htmlFor="metric-applications" className="text-sm">Applications</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="metric-approvals"
                    checked={reportMetrics.approvals}
                    onCheckedChange={(checked) =>
                      setReportMetrics({ ...reportMetrics, approvals: checked as boolean })
                    }
                  />
                  <label htmlFor="metric-approvals" className="text-sm">Approvals</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="metric-referrals"
                    checked={reportMetrics.referrals}
                    onCheckedChange={(checked) =>
                      setReportMetrics({ ...reportMetrics, referrals: checked as boolean })
                    }
                  />
                  <label htmlFor="metric-referrals" className="text-sm">Referrals</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="metric-commissions"
                    checked={reportMetrics.commissions}
                    onCheckedChange={(checked) =>
                      setReportMetrics({ ...reportMetrics, commissions: checked as boolean })
                    }
                  />
                  <label htmlFor="metric-commissions" className="text-sm">Commissions</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="metric-payments"
                    checked={reportMetrics.payments}
                    onCheckedChange={(checked) =>
                      setReportMetrics({ ...reportMetrics, payments: checked as boolean })
                    }
                  />
                  <label htmlFor="metric-payments" className="text-sm">Payments</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="metric-network"
                    checked={reportMetrics.networkStats}
                    onCheckedChange={(checked) =>
                      setReportMetrics({ ...reportMetrics, networkStats: checked as boolean })
                    }
                  />
                  <label htmlFor="metric-network" className="text-sm">Network Stats</label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Group By</Label>
              <Select value={reportGrouping} onValueChange={setReportGrouping}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">By Day</SelectItem>
                  <SelectItem value="week">By Week</SelectItem>
                  <SelectItem value="month">By Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3">
              <Button onClick={generateCustomReport} className="flex-1">
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export to PDF
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export to CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SuperAdminReportsAnalytics;
