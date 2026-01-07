import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  User,
  Mail,
  Phone,
  CreditCard,
  FileText,
  TrendingUp,
  Store,
  Copy,
  ExternalLink,
  DollarSign,
  Calendar,
  UserCheck,
  Eye,
  Download,
} from "lucide-react";

interface ViewHelperDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  helperId: string;
  helperName: string;
}

interface HelperDetails {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  referral_code: string;
  status: string;
  direct_commission_rate: number;
  network_commission_rate: number;
  created_at: string;
  application_id?: string | null;
  recruited_by_helper_id?: string | null;
  helper_recruitment_link?: string;
  store_referral_link?: string;
}

interface HelperApplication {
  why_helper: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_ifsc_code: string;
  bank_name: string;
  created_at: string;
  approved_at: string | null;
  approved_by_admin: string | null;
  recruited_by_helper_id: string | null;
}

interface RecruitedStore {
  store_id: string;
  store_name: string;
  store_slug: string;
  store_owner_name: string;
  created_at: string;
}

interface CommissionData {
  total_earned: number;
  store_referrals: number;
  product_sales: number;
  network_bonus: number;
}

export default function ViewHelperDetailsModal({
  open,
  onOpenChange,
  helperId,
  helperName,
}: ViewHelperDetailsModalProps) {
  const [loading, setLoading] = useState(true);
  const [helperDetails, setHelperDetails] = useState<HelperDetails | null>(null);
  const [applicationDetails, setApplicationDetails] = useState<HelperApplication | null>(null);
  const [recruitedStores, setRecruitedStores] = useState<RecruitedStore[]>([]);
  const [commissionData, setCommissionData] = useState<CommissionData>({
    total_earned: 0,
    store_referrals: 0,
    product_sales: 0,
    network_bonus: 0,
  });
  const [recruiterName, setRecruiterName] = useState<string | null>(null);
  const [approverName, setApproverName] = useState<string | null>(null);

  useEffect(() => {
    if (open && helperId) {
      loadAllData();
    }
  }, [open, helperId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadHelperDetails(),
        loadApplicationDetails(),
        loadRecruitedStores(),
        loadCommissionData(),
      ]);
    } catch (error) {
      console.error("Error loading helper data:", error);
      toast.error("Failed to load helper details");
    } finally {
      setLoading(false);
    }
  };

  const loadHelperDetails = async () => {
    const { data, error } = await supabase
      .from("helpers")
      .select("*")
      .eq("id", helperId)
      .single();

    if (error) throw error;
    setHelperDetails(data);
  };

  const loadApplicationDetails = async () => {
    const { data, error } = await supabase
      .from("helper_applications")
      .select("*")
      .eq("user_id", helperId)
      .single();

    if (error) {
      console.warn("No application found for helper");
      return;
    }

    setApplicationDetails(data);

    // Load recruiter name if exists
    if (data.recruited_by_helper_id) {
      const { data: recruiter } = await supabase
        .from("helpers")
        .select("full_name")
        .eq("id", data.recruited_by_helper_id)
        .single();

      if (recruiter) {
        setRecruiterName(recruiter.full_name);
      }
    }

    // Load approver name if exists
    if (data.approved_by_admin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", data.approved_by_admin)
        .single();

      if (profile) {
        setApproverName(profile.full_name);
      }
    }
  };

  const loadRecruitedStores = async () => {
    const { data, error } = await supabase
      .from("store_referrals")
      .select(`
        store_id,
        store_owner_name,
        created_at,
        stores (
          name,
          slug
        )
      `)
      .eq("helper_id", helperId);

    if (error) {
      console.error("Error loading recruited stores:", error);
      return;
    }

    const formattedStores: RecruitedStore[] = (data || []).map((item: any) => ({
      store_id: item.store_id,
      store_name: item.stores?.name || "Unknown Store",
      store_slug: item.stores?.slug || "",
      store_owner_name: item.store_owner_name,
      created_at: item.created_at,
    }));

    setRecruitedStores(formattedStores);
  };

  const loadCommissionData = async () => {
    const { data, error } = await supabase
      .from("network_commissions")
      .select("direct_commission_amount, network_commission_amount, commission_status")
      .eq("earning_helper_id", helperId);

    if (error) {
      console.error("Error loading commission data:", error);
      return;
    }

    let total = 0;
    let storeRef = 0;
    let productSales = 0;
    let networkBonus = 0;

    (data || []).forEach((commission: any) => {
      const amount = commission.amount || 0;
      total += amount;

      if (commission.commission_type === "store_referral") {
        storeRef += amount;
      } else if (commission.commission_type === "product_sale") {
        productSales += amount;
      } else if (commission.commission_type === "network_bonus") {
        networkBonus += amount;
      }
    });

    setCommissionData({
      total_earned: total,
      store_referrals: storeRef,
      product_sales: productSales,
      network_bonus: networkBonus,
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const handleViewAsHelper = () => {
    // Open helper dashboard in new tab (impersonation mode)
    const url = `/helper/dashboard?impersonate=${helperId}`;
    window.open(url, "_blank");
  };

  const handleExportPDF = () => {
    toast.info("PDF export feature coming soon!");
    // TODO: Implement PDF export
  };

  if (loading || !helperDetails) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading helper details...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const daysActive = Math.floor(
    (new Date().getTime() - new Date(helperDetails.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Helper Details - {helperName}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="stores">Recruited Stores ({recruitedStores.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Full Name</p>
                    <p className="font-medium">{helperDetails.full_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{helperDetails.email}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(helperDetails.email, "Email")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{helperDetails.phone}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(helperDetails.phone, "Phone")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Helper ID</p>
                    <p className="font-mono text-sm">{helperDetails.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant={helperDetails.status === "Active" ? "default" : "destructive"}>
                      {helperDetails.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Referral Code</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-medium">{helperDetails.referral_code}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(helperDetails.referral_code, "Referral Code")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bank Account Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Bank Account Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {applicationDetails ? (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">Account Name</p>
                        <p className="font-medium">{applicationDetails.bank_account_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Account Number</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono">{applicationDetails.bank_account_number}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              copyToClipboard(applicationDetails.bank_account_number, "Account Number")
                            }
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">IFSC Code</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono">{applicationDetails.bank_ifsc_code}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(applicationDetails.bank_ifsc_code, "IFSC Code")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Bank Name</p>
                        <p className="font-medium">{applicationDetails.bank_name}</p>
                      </div>
                      <div className="pt-2">
                        <Badge variant="outline" className="bg-green-50">
                          ✅ Verified
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No bank details available</p>
                  )}
                </CardContent>
              </Card>

              {/* Application Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Application Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {applicationDetails ? (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">Applied On</p>
                        <p className="font-medium text-sm">
                          {format(new Date(applicationDetails.created_at), "PPp")}
                        </p>
                      </div>
                      {applicationDetails.approved_at && (
                        <div>
                          <p className="text-xs text-muted-foreground">Approved On</p>
                          <p className="font-medium text-sm">
                            {format(new Date(applicationDetails.approved_at), "PPp")}
                          </p>
                        </div>
                      )}
                      {approverName && (
                        <div>
                          <p className="text-xs text-muted-foreground">Approved By</p>
                          <p className="font-medium">{approverName}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Why Helper?</p>
                        <p className="text-sm mt-1">{applicationDetails.why_helper || "Not provided"}</p>
                      </div>
                      {recruiterName && (
                        <div>
                          <p className="text-xs text-muted-foreground">Recruited By</p>
                          <p className="font-medium">{recruiterName}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No application details available</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      ₹{commissionData.total_earned.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Total Earned</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{recruitedStores.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Stores Recruited</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">{daysActive}</p>
                    <p className="text-xs text-muted-foreground mt-1">Days Active</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">
                      {helperDetails.direct_commission_rate}% / {helperDetails.network_commission_rate}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Direct / Network Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: PERFORMANCE */}
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Commission Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Store Referrals</span>
                    </div>
                    <span className="font-bold text-blue-600">
                      ₹{commissionData.store_referrals.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Product Sales</span>
                    </div>
                    <span className="font-bold text-green-600">
                      ₹{commissionData.product_sales.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                      <span className="text-sm">Network Bonus</span>
                    </div>
                    <span className="font-bold text-purple-600">
                      ₹{commissionData.network_bonus.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg border-2 border-primary">
                    <span className="font-semibold">Total Earned</span>
                    <span className="text-xl font-bold text-primary">
                      ₹{commissionData.total_earned.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Status History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">Active</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(helperDetails.created_at), "PPp")}
                        {approverName && ` (Approved by ${approverName})`}
                      </p>
                    </div>
                  </div>
                  {applicationDetails && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">Application Received</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(applicationDetails.created_at), "PPp")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: RECRUITED STORES */}
          <TabsContent value="stores" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    Recruited Stores ({recruitedStores.length} Total)
                  </CardTitle>
                  {recruitedStores.length > 0 && (
                    <Badge variant="outline">
                      Avg. Commission: ₹
                      {recruitedStores.length > 0
                        ? Math.round(commissionData.store_referrals / recruitedStores.length)
                        : 0}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {recruitedStores.length === 0 ? (
                  <div className="text-center py-8">
                    <Store className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground">No recruited stores yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Helper hasn't referred any stores
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recruitedStores.map((store, index) => (
                      <div
                        key={store.store_id}
                        className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold">
                                {index + 1}. {store.store_name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                Active
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              Owner: {store.store_owner_name} | Joined:{" "}
                              {format(new Date(store.created_at), "PP")}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(`/store/${store.store_id}`, "_blank")}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View Store
                              </Button>
                              {store.store_slug && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    window.open(
                                      `https://${store.store_slug}.digitaldukandar.in`,
                                      "_blank"
                                    )
                                  }
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Visit Website
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: ACTIVITY */}
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recruitedStores.slice(0, 5).map((store) => (
                    <div key={store.store_id} className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div>
                        <p>
                          Recruited store <span className="font-semibold">"{store.store_name}"</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(store.created_at), "PPp")}
                        </p>
                      </div>
                    </div>
                  ))}
                  {applicationDetails && (
                    <div className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      <div>
                        <p>Approved as helper</p>
                        <p className="text-xs text-muted-foreground">
                          {applicationDetails.approved_at
                            ? format(new Date(applicationDetails.approved_at), "PPp")
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  )}
                  {applicationDetails && (
                    <div className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                      <div>
                        <p>Applied for helper</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(applicationDetails.created_at), "PPp")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end mt-4 pt-4 border-t">
          <Button variant="outline" onClick={handleViewAsHelper}>
            <Eye className="h-4 w-4 mr-2" />
            View as Helper
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
