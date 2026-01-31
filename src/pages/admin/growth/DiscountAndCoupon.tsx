import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Plus,
  Ticket,
  Search,
  Loader2,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Eye,
  DollarSign,
  TrendingDown,
  BarChart3,
  Activity,
  TrendingUp,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  getCouponStats,
  getCouponUsageCount,
  type Coupon,
  generateCouponCode,
} from "@/lib/couponUtils";
import { getAutoDiscountStats, type AutoDiscount } from "@/lib/autoDiscountUtils";
import { CreateCouponModal } from "@/components/admin/CreateCouponModal";
import { CreateAutoDiscountModal } from "@/components/admin/CreateAutoDiscountModal";
import { CouponUsageModal } from "@/components/admin/CouponUsageModal";

const DiscountAndCoupon = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [storeId, setStoreId] = useState<string>("");

  // Switch state: true = Coupons, false = Automatic Discounts
  const [showCoupons, setShowCoupons] = useState(true);

  // Coupon state
  const [coupons, setCoups] = useState<Coupon[]>([]);
  const [filteredCoupons, setFilteredCoupons] = useState<Coupon[]>([]);
  const [couponSearchTerm, setCouponSearchTerm] = useState("");
  const [couponStatusFilter, setCouponStatusFilter] = useState("all");
  const [couponCurrentPage, setCouponCurrentPage] = useState(1);
  const [couponUsageCounts, setCouponUsageCounts] = useState<Record<string, number>>({});
  const [couponStats, setCouponStats] = useState({
    totalCoupons: 0,
    activeCoupons: 0,
    totalUsage: 0,
    totalDiscountGiven: 0,
  });
  const [showCreateCouponModal, setShowCreateCouponModal] = useState(false);
  const [couponToEdit, setCouponToEdit] = useState<Coupon | null>(null);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedCouponForUsage, setSelectedCouponForUsage] = useState<Coupon | null>(null);

  // Auto-discount state
  const [autoDiscounts, setAutoDiscounts] = useState<AutoDiscount[]>([]);
  const [filteredAutoDiscounts, setFilteredAutoDiscounts] = useState<AutoDiscount[]>([]);
  const [autoDiscountSearchTerm, setAutoDiscountSearchTerm] = useState("");
  const [autoDiscountStatusFilter, setAutoDiscountStatusFilter] = useState("all");
  const [autoDiscountCurrentPage, setAutoDiscountCurrentPage] = useState(1);
  const [autoDiscountStats, setAutoDiscountStats] = useState({
    totalRules: 0,
    activeRules: 0,
  });
  const [showCreateAutoDiscountModal, setShowCreateAutoDiscountModal] = useState(false);
  const [autoDiscountToEdit, setAutoDiscountToEdit] = useState<AutoDiscount | null>(null);

  const itemsPerPage = 10;

  useEffect(() => {
    loadStoreData();
  }, []);

  useEffect(() => {
    if (storeId) {
      loadCoupons();
      loadCouponStats();
      loadAutoDiscounts();
      loadAutoDiscountStats();
    }
  }, [storeId]);

  useEffect(() => {
    filterCoupons();
  }, [coupons, couponSearchTerm, couponStatusFilter]);

  useEffect(() => {
    filterAutoDiscounts();
  }, [autoDiscounts, autoDiscountSearchTerm, autoDiscountStatusFilter]);

  const loadStoreData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (store) {
        setStoreId(store.id);
      }
    } catch (error) {
      console.error("Error loading store data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ============ COUPON FUNCTIONS ============

  const loadCouponUsageCounts = async (couponIds: string[]) => {
    try {
      const counts: Record<string, number> = {};
      for (const couponId of couponIds) {
        const count = await getCouponUsageCount(couponId);
        counts[couponId] = count;
      }
      setCouponUsageCounts(counts);
    } catch (error) {
      console.error("Error loading coupon usage counts:", error);
    }
  };

  const loadCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCoups(data || []);

      // Load usage counts for all coupons
      if (data && data.length > 0) {
        await loadCouponUsageCounts(data.map((c) => c.id));
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load coupons",
      });
    }
  };

  const loadCouponStats = async () => {
    try {
      const stats = await getCouponStats(storeId);
      setCouponStats(stats);
    } catch (error) {
      console.error("Error loading coupon stats:", error);
    }
  };

  const filterCoupons = () => {
    let filtered = coupons.filter((coupon) => {
      const matchesSearch = coupon.code.toLowerCase().includes(couponSearchTerm.toLowerCase()) ||
        (coupon.description || "").toLowerCase().includes(couponSearchTerm.toLowerCase());
      const matchesStatus = couponStatusFilter === "all" || coupon.status === couponStatusFilter;
      return matchesSearch && matchesStatus;
    });

    setFilteredCoupons(filtered);
    setCouponCurrentPage(1);
  };

  const handleCreateCoupon = async (couponData: any) => {
    setIsSaving(true);
    try {
      const { selectedProducts, selectedCategories, ...coupon } = couponData;

      if (couponToEdit) {
        const { error } = await supabase
          .from("coupons")
          .update(coupon)
          .eq("id", couponToEdit.id);

        if (error) throw error;

        await supabase.from("coupon_products").delete().eq("coupon_id", couponToEdit.id);
        await supabase.from("coupon_categories").delete().eq("coupon_id", couponToEdit.id);

        if (selectedProducts?.length > 0) {
          await supabase.from("coupon_products").insert(
            selectedProducts.map((productId: string) => ({
              coupon_id: couponToEdit.id,
              product_id: productId,
              is_excluded: false,
            }))
          );
        }

        if (selectedCategories?.length > 0) {
          await supabase.from("coupon_categories").insert(
            selectedCategories.map((categoryId: string) => ({
              coupon_id: couponToEdit.id,
              category_id: categoryId,
            }))
          );
        }

        toast({
          title: "Coupon Updated",
          description: "Coupon has been updated successfully",
        });
      } else {
        const { data: newCoupon, error } = await supabase
          .from("coupons")
          .insert(coupon)
          .select()
          .single();

        if (error) throw error;

        if (selectedProducts?.length > 0) {
          await supabase.from("coupon_products").insert(
            selectedProducts.map((productId: string) => ({
              coupon_id: newCoupon.id,
              product_id: productId,
              is_excluded: false,
            }))
          );
        }

        if (selectedCategories?.length > 0) {
          await supabase.from("coupon_categories").insert(
            selectedCategories.map((categoryId: string) => ({
              coupon_id: newCoupon.id,
              category_id: categoryId,
            }))
          );
        }

        toast({
          title: "Coupon Created",
          description: `Coupon "${newCoupon.code}" has been created successfully`,
        });
      }

      setCouponToEdit(null);
      await loadCoupons();
      await loadCouponStats();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save coupon",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!confirm("Are you sure you want to delete this coupon?")) return;

    try {
      const { error } = await supabase
        .from("coupons")
        .delete()
        .eq("id", couponId);

      if (error) throw error;

      toast({
        title: "Coupon Deleted",
        description: "Coupon has been deleted successfully",
      });

      await loadCoupons();
      await loadCouponStats();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete coupon",
      });
    }
  };

  const handleDuplicateCoupon = async (coupon: Coupon) => {
    try {
      const newCode = generateCouponCode();
      const { error } = await supabase.from("coupons").insert({
        ...coupon,
        id: undefined,
        code: newCode,
        created_at: undefined,
        updated_at: undefined,
      });

      if (error) throw error;

      toast({
        title: "Coupon Duplicated",
        description: `New coupon created with code "${newCode}"`,
      });

      await loadCoupons();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to duplicate coupon",
      });
    }
  };

  const toggleCouponStatus = async (coupon: Coupon) => {
    try {
      const newStatus = coupon.status === "active" ? "disabled" : "active";
      const { error } = await supabase
        .from("coupons")
        .update({ status: newStatus })
        .eq("id", coupon.id);

      if (error) throw error;

      toast({
        title: "Coupon Updated",
        description: `Coupon has been ${newStatus}`,
      });

      await loadCoupons();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update coupon",
      });
    }
  };

  // ============ AUTO-DISCOUNT FUNCTIONS ============

  const loadAutoDiscounts = async () => {
    try {
      const { data, error } = await supabase
        .from("automatic_discounts")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAutoDiscounts(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load auto-discounts",
      });
    }
  };

  const loadAutoDiscountStats = async () => {
    try {
      const stats = await getAutoDiscountStats(storeId);
      setAutoDiscountStats(stats);
    } catch (error) {
      console.error("Error loading auto-discount stats:", error);
    }
  };

  const filterAutoDiscounts = () => {
    let filtered = autoDiscounts.filter((discount) => {
      const matchesSearch = discount.rule_name.toLowerCase().includes(autoDiscountSearchTerm.toLowerCase()) ||
        (discount.rule_description || "").toLowerCase().includes(autoDiscountSearchTerm.toLowerCase());
      const matchesStatus = autoDiscountStatusFilter === "all" || discount.status === autoDiscountStatusFilter;
      return matchesSearch && matchesStatus;
    });

    setFilteredAutoDiscounts(filtered);
    setAutoDiscountCurrentPage(1);
  };

  const handleCreateAutoDiscount = async (discountData: any) => {
    setIsSaving(true);
    try {
      const { tiers, rules, ...discount } = discountData;

      if (autoDiscountToEdit) {
        const { error } = await supabase
          .from("automatic_discounts")
          .update(discount)
          .eq("id", autoDiscountToEdit.id);

        if (error) throw error;

        if (discount.rule_type === "tiered_value") {
          await supabase.from("discount_tiers").delete().eq("discount_id", autoDiscountToEdit.id);

          if (tiers?.length > 0) {
            await supabase.from("discount_tiers").insert(
              tiers.map((tier: any) => ({
                discount_id: autoDiscountToEdit.id,
                tier_order: tier.tier_order,
                min_order_value: tier.min_order_value,
                discount_type: tier.discount_type,
                discount_value: tier.discount_value,
              }))
            );
          }
        }

        await supabase.from("discount_rules").delete().eq("discount_id", autoDiscountToEdit.id);

        if (rules?.length > 0) {
          await supabase.from("discount_rules").insert(
            rules.map((rule: any) => ({
              discount_id: autoDiscountToEdit.id,
              rule_type: rule.rule_type,
              rule_value: rule.rule_value,
              discount_type: rule.discount_type,
              discount_value: rule.discount_value,
            }))
          );
        }

        toast({
          title: "Auto-Discount Updated",
          description: "Automatic discount has been updated successfully",
        });
      } else {
        const { data: newDiscount, error } = await supabase
          .from("automatic_discounts")
          .insert(discount)
          .select()
          .single();

        if (error) throw error;

        if (discount.rule_type === "tiered_value" && tiers?.length > 0) {
          await supabase.from("discount_tiers").insert(
            tiers.map((tier: any) => ({
              discount_id: newDiscount.id,
              tier_order: tier.tier_order,
              min_order_value: tier.min_order_value,
              discount_type: tier.discount_type,
              discount_value: tier.discount_value,
            }))
          );
        }

        if (rules?.length > 0) {
          await supabase.from("discount_rules").insert(
            rules.map((rule: any) => ({
              discount_id: newDiscount.id,
              rule_type: rule.rule_type,
              rule_value: rule.rule_value,
              discount_type: rule.discount_type,
              discount_value: rule.discount_value,
            }))
          );
        }

        toast({
          title: "Auto-Discount Created",
          description: `Discount "${newDiscount.rule_name}" has been created successfully`,
        });
      }

      setAutoDiscountToEdit(null);
      await loadAutoDiscounts();
      await loadAutoDiscountStats();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save auto-discount",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAutoDiscount = async (discountId: string) => {
    if (!confirm("Are you sure you want to delete this discount?")) return;

    try {
      const { error } = await supabase
        .from("automatic_discounts")
        .delete()
        .eq("id", discountId);

      if (error) throw error;

      toast({
        title: "Auto-Discount Deleted",
        description: "Automatic discount has been deleted successfully",
      });

      await loadAutoDiscounts();
      await loadAutoDiscountStats();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete auto-discount",
      });
    }
  };

  const handleDuplicateAutoDiscount = async (discount: AutoDiscount) => {
    try {
      const { error } = await supabase.from("automatic_discounts").insert({
        ...discount,
        id: undefined,
        rule_name: `${discount.rule_name} (Copy)`,
        created_at: undefined,
        updated_at: undefined,
      });

      if (error) throw error;

      toast({
        title: "Auto-Discount Duplicated",
        description: `New discount created: "${discount.rule_name} (Copy)"`,
      });

      await loadAutoDiscounts();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to duplicate auto-discount",
      });
    }
  };

  const toggleAutoDiscountStatus = async (discount: AutoDiscount) => {
    try {
      const newStatus = discount.status === "active" ? "disabled" : "active";
      const { error } = await supabase
        .from("automatic_discounts")
        .update({ status: newStatus })
        .eq("id", discount.id);

      if (error) throw error;

      toast({
        title: "Auto-Discount Updated",
        description: `Discount has been ${newStatus}`,
      });

      await loadAutoDiscounts();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update auto-discount",
      });
    }
  };

  // ============ HELPERS ============

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400";
      case "disabled":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
      case "expired":
        return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(value);
  };

  const getRuleTypeLabel = (ruleType: string) => {
    switch (ruleType) {
      case "tiered_value":
        return "Tiered by Value";
      case "new_customer":
        return "New Customer";
      case "returning_customer":
        return "Returning Customer";
      case "category":
        return "Category";
      case "quantity":
        return "Quantity";
      default:
        return ruleType;
    }
  };

  const getPaymentTypeLabel = (orderType: string) => {
    switch (orderType) {
      case "all":
        return "All Methods";
      case "online":
        return "Online";
      case "cod":
        return "COD";
      default:
        return orderType;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const paginatedCoupons = filteredCoupons.slice(
    (couponCurrentPage - 1) * itemsPerPage,
    couponCurrentPage * itemsPerPage
  );
  const totalCouponPages = Math.ceil(filteredCoupons.length / itemsPerPage);

  const paginatedAutoDiscounts = filteredAutoDiscounts.slice(
    (autoDiscountCurrentPage - 1) * itemsPerPage,
    autoDiscountCurrentPage * itemsPerPage
  );
  const totalAutoDiscountPages = Math.ceil(filteredAutoDiscounts.length / itemsPerPage);

  return (
    <>
      <div className="space-y-6">
        {/* Header with Switch Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Ticket className="w-6 h-6" />
              Discounts & Coupons
            </h1>
            <p className="text-muted-foreground mt-1">
              {showCoupons ? "Manage coupon codes for your store" : "Create automatic discount rules"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Switch Button */}
            <div className="flex gap-1 bg-muted p-1 rounded-lg border">
              <Button
                variant={showCoupons ? "default" : "ghost"}
                size="sm"
                onClick={() => setShowCoupons(true)}
                className="gap-1"
              >
                <Ticket className="w-4 h-4" />
                Coupons
              </Button>
              <Button
                variant={!showCoupons ? "default" : "ghost"}
                size="sm"
                onClick={() => setShowCoupons(false)}
                className="gap-1"
              >
                <TrendingUp className="w-4 h-4" />
                Automatic Discounts
              </Button>
            </div>

            {/* Create Button */}
            <Button
              onClick={() => {
                if (showCoupons) {
                  setCouponToEdit(null);
                  setShowCreateCouponModal(true);
                } else {
                  setAutoDiscountToEdit(null);
                  setShowCreateAutoDiscountModal(true);
                }
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              {showCoupons ? "Create Coupon" : "Create Discount"}
            </Button>
          </div>
        </div>

        {/* ============ COUPONS VIEW ============ */}
        {showCoupons && (
          <>
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Ticket className="w-4 h-4" />
                    Total Coupons
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{couponStats.totalCoupons}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Active Coupons
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {couponStats.activeCoupons}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Total Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{couponStats.totalUsage}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" />
                    Total Discount Given
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {formatCurrency(couponStats.totalDiscountGiven)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filter & Search</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Search</label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by code or description..."
                        value={couponSearchTerm}
                        onChange={(e) => setCouponSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={couponStatusFilter} onValueChange={setCouponStatusFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Coupons Table */}
            <Card>
              <CardHeader>
                <CardTitle>Coupons</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredCoupons.length === 0 ? (
                  <div className="text-center py-12">
                    <Ticket className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No coupons found</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Discount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Valid Until</TableHead>
                            <TableHead>Usage</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedCoupons.map((coupon) => (
                            <TableRow key={coupon.id}>
                              <TableCell className="font-medium">{coupon.code}</TableCell>
                              <TableCell>
                                {coupon.discount_type === "percentage"
                                  ? `${coupon.discount_value}%`
                                  : `₹${coupon.discount_value}`}
                                {coupon.max_discount && coupon.discount_type === "percentage" && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    (max ₹{coupon.max_discount})
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(coupon.status)}>
                                  {coupon.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {new Date(coupon.expiry_date).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-sm">
                                {coupon.usage_limit_total
                                  ? `${couponUsageCounts[coupon.id] || 0}/${coupon.usage_limit_total}`
                                  : "Unlimited"}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setCouponToEdit(coupon);
                                        setShowCreateCouponModal(true);
                                      }}
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedCouponForUsage(coupon);
                                        setShowUsageModal(true);
                                      }}
                                    >
                                      <Eye className="w-4 h-4 mr-2" />
                                      View Usage
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDuplicateCoupon(coupon)}
                                    >
                                      <Copy className="w-4 h-4 mr-2" />
                                      Duplicate
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => toggleCouponStatus(coupon)}
                                    >
                                      <Eye className="w-4 h-4 mr-2" />
                                      {coupon.status === "active" ? "Disable" : "Enable"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteCoupon(coupon.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    {totalCouponPages > 1 && (
                      <div className="mt-6">
                        <Pagination>
                          <PaginationContent>
                            {couponCurrentPage > 1 && (
                              <PaginationItem>
                                <PaginationPrevious
                                  onClick={() => setCouponCurrentPage(couponCurrentPage - 1)}
                                />
                              </PaginationItem>
                            )}

                            {Array.from({ length: totalCouponPages }, (_, i) => i + 1).map(
                              (page) => (
                                <PaginationItem key={page}>
                                  <PaginationLink
                                    onClick={() => setCouponCurrentPage(page)}
                                    isActive={couponCurrentPage === page}
                                  >
                                    {page}
                                  </PaginationLink>
                                </PaginationItem>
                              )
                            )}

                            {couponCurrentPage < totalCouponPages && (
                              <PaginationItem>
                                <PaginationNext
                                  onClick={() => setCouponCurrentPage(couponCurrentPage + 1)}
                                />
                              </PaginationItem>
                            )}
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ============ AUTOMATIC DISCOUNTS VIEW ============ */}
        {!showCoupons && (
          <>
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Total Rules
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{autoDiscountStats.totalRules}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Active Rules
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {autoDiscountStats.activeRules}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filter & Search</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Search</label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by rule name or description..."
                        value={autoDiscountSearchTerm}
                        onChange={(e) => setAutoDiscountSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={autoDiscountStatusFilter} onValueChange={setAutoDiscountStatusFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Auto-Discounts Table */}
            <Card>
              <CardHeader>
                <CardTitle>Automatic Discount Rules</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredAutoDiscounts.length === 0 ? (
                  <div className="text-center py-12">
                    <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No discount rules found</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rule Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Payment</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Valid Until</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedAutoDiscounts.map((discount) => (
                            <TableRow key={discount.id}>
                              <TableCell className="font-medium">{discount.rule_name}</TableCell>
                              <TableCell className="text-sm">
                                {getRuleTypeLabel(discount.rule_type)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {getPaymentTypeLabel(discount.order_type)}
                              </TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(discount.status)}>
                                  {discount.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {new Date(discount.expiry_date).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setAutoDiscountToEdit(discount);
                                        setShowCreateAutoDiscountModal(true);
                                      }}
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDuplicateAutoDiscount(discount)}
                                    >
                                      <Copy className="w-4 h-4 mr-2" />
                                      Duplicate
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => toggleAutoDiscountStatus(discount)}
                                    >
                                      <Eye className="w-4 h-4 mr-2" />
                                      {discount.status === "active" ? "Disable" : "Enable"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteAutoDiscount(discount.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    {totalAutoDiscountPages > 1 && (
                      <div className="mt-6">
                        <Pagination>
                          <PaginationContent>
                            {autoDiscountCurrentPage > 1 && (
                              <PaginationItem>
                                <PaginationPrevious
                                  onClick={() => setAutoDiscountCurrentPage(autoDiscountCurrentPage - 1)}
                                />
                              </PaginationItem>
                            )}

                            {Array.from({ length: totalAutoDiscountPages }, (_, i) => i + 1).map(
                              (page) => (
                                <PaginationItem key={page}>
                                  <PaginationLink
                                    onClick={() => setAutoDiscountCurrentPage(page)}
                                    isActive={autoDiscountCurrentPage === page}
                                  >
                                    {page}
                                  </PaginationLink>
                                </PaginationItem>
                              )
                            )}

                            {autoDiscountCurrentPage < totalAutoDiscountPages && (
                              <PaginationItem>
                                <PaginationNext
                                  onClick={() => setAutoDiscountCurrentPage(autoDiscountCurrentPage + 1)}
                                />
                              </PaginationItem>
                            )}
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Modals */}
      <CreateCouponModal
        open={showCreateCouponModal}
        onClose={() => {
          setShowCreateCouponModal(false);
          setCouponToEdit(null);
        }}
        onSave={handleCreateCoupon}
        storeId={storeId}
        couponToEdit={couponToEdit}
      />

      <CreateAutoDiscountModal
        open={showCreateAutoDiscountModal}
        onClose={() => {
          setShowCreateAutoDiscountModal(false);
          setAutoDiscountToEdit(null);
        }}
        onSave={handleCreateAutoDiscount}
        storeId={storeId}
        discountToEdit={autoDiscountToEdit}
      />

      <CouponUsageModal
        couponCode={selectedCouponForUsage?.code || ""}
        couponId={selectedCouponForUsage?.id || ""}
        open={showUsageModal}
        onClose={() => {
          setShowUsageModal(false);
          setSelectedCouponForUsage(null);
        }}
      />
    </>
  );
};

export default DiscountAndCoupon;
