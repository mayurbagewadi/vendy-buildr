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
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  getCouponStats,
  type Coupon,
  generateCouponCode,
} from "@/lib/couponUtils";
import { CreateCouponModal } from "@/components/admin/CreateCouponModal";

const DiscountAndCoupon = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [storeId, setStoreId] = useState<string>("");
  const [coupons, setCoups] = useState<Coupon[]>([]);
  const [filteredCoupons, setFilteredCoupons] = useState<Coupon[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState({
    totalCoupons: 0,
    activeCoupons: 0,
    totalUsage: 0,
    totalDiscountGiven: 0,
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [couponToEdit, setCouponToEdit] = useState<Coupon | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    loadStoreData();
  }, []);

  useEffect(() => {
    if (storeId) {
      loadCoupons();
      loadStats();
    }
  }, [storeId]);

  useEffect(() => {
    filterCoupons();
  }, [coupons, searchTerm, statusFilter]);

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

  const loadCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCoups(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load coupons",
      });
    }
  };

  const loadStats = async () => {
    try {
      const stats = await getCouponStats(storeId);
      setStats(stats);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const filterCoupons = () => {
    let filtered = coupons.filter((coupon) => {
      const matchesSearch = coupon.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (coupon.description || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || coupon.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    setFilteredCoupons(filtered);
    setCurrentPage(1);
  };

  const handleCreateCoupon = async (couponData: any) => {
    setIsSaving(true);
    try {
      const { selectedProducts, selectedCategories, ...coupon } = couponData;

      if (couponToEdit) {
        // Update existing coupon
        const { error } = await supabase
          .from("coupons")
          .update(coupon)
          .eq("id", couponToEdit.id);

        if (error) throw error;

        // Update related products and categories
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
        // Create new coupon
        const { data: newCoupon, error } = await supabase
          .from("coupons")
          .insert(coupon)
          .select()
          .single();

        if (error) throw error;

        // Add related products
        if (selectedProducts?.length > 0) {
          await supabase.from("coupon_products").insert(
            selectedProducts.map((productId: string) => ({
              coupon_id: newCoupon.id,
              product_id: productId,
              is_excluded: false,
            }))
          );
        }

        // Add related categories
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
      await loadStats();
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
      await loadStats();
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const paginatedCoupons = filteredCoupons.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(filteredCoupons.length / itemsPerPage);

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Ticket className="w-6 h-6" />
              Discounts & Coupons
            </h1>
            <p className="text-muted-foreground mt-1">
              Create and manage discount coupons for your store
            </p>
          </div>
          <Button
            onClick={() => {
              setCouponToEdit(null);
              setShowCreateModal(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Coupon
          </Button>
        </div>

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
              <div className="text-2xl font-bold">{stats.totalCoupons}</div>
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
                {stats.activeCoupons}
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
              <div className="text-2xl font-bold">{stats.totalUsage}</div>
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
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(stats.totalDiscountGiven)}
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
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
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
                              ? `${0}/${coupon.usage_limit_total}`
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
                                    setShowCreateModal(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
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
                {totalPages > 1 && (
                  <div className="mt-6">
                    <Pagination>
                      <PaginationContent>
                        {currentPage > 1 && (
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setCurrentPage(currentPage - 1)}
                            />
                          </PaginationItem>
                        )}

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                          (page) => (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setCurrentPage(page)}
                                isActive={currentPage === page}
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        )}

                        {currentPage < totalPages && (
                          <PaginationItem>
                            <PaginationNext
                              onClick={() => setCurrentPage(currentPage + 1)}
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
      </div>

      {/* Create Coupon Modal */}
      <CreateCouponModal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCouponToEdit(null);
        }}
        onSave={handleCreateCoupon}
        storeId={storeId}
        couponToEdit={couponToEdit}
      />
    </>
  );
};

export default DiscountAndCoupon;
