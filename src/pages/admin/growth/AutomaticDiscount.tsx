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
  Search,
  Loader2,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Eye,
  TrendingUp,
  Activity,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  getAutoDiscountStats,
  type AutoDiscount,
} from "@/lib/autoDiscountUtils";
import { CreateAutoDiscountModal } from "@/components/admin/CreateAutoDiscountModal";

const AutomaticDiscount = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [storeId, setStoreId] = useState<string>("");
  const [discounts, setDiscounts] = useState<AutoDiscount[]>([]);
  const [filteredDiscounts, setFilteredDiscounts] = useState<AutoDiscount[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState({
    totalRules: 0,
    activeRules: 0,
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [discountToEdit, setDiscountToEdit] = useState<AutoDiscount | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    loadStoreData();
  }, []);

  useEffect(() => {
    if (storeId) {
      loadDiscounts();
      loadStats();
    }
  }, [storeId]);

  useEffect(() => {
    filterDiscounts();
  }, [discounts, searchTerm, statusFilter]);

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

  const loadDiscounts = async () => {
    try {
      const { data, error } = await supabase
        .from("automatic_discounts")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDiscounts((data as AutoDiscount[]) || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load discounts",
      });
    }
  };

  const loadStats = async () => {
    try {
      const stats = await getAutoDiscountStats(storeId);
      setStats(stats);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const filterDiscounts = () => {
    let filtered = discounts.filter((discount) => {
      const matchesSearch = discount.rule_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (discount.rule_description || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || discount.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    setFilteredDiscounts(filtered);
    setCurrentPage(1);
  };

  const handleCreateDiscount = async (discountData: any) => {
    setIsSaving(true);
    try {
      const { tiers, rules, ...discount } = discountData;

      if (discountToEdit) {
        // Update existing discount
        const { error } = await supabase
          .from("automatic_discounts")
          .update(discount)
          .eq("id", discountToEdit.id);

        if (error) throw error;

        // Delete and recreate tiers
        if (discount.rule_type === "tiered_value") {
          await supabase.from("discount_tiers").delete().eq("discount_id", discountToEdit.id);

          if (tiers?.length > 0) {
            await supabase.from("discount_tiers").insert(
              tiers.map((tier: any) => ({
                discount_id: discountToEdit.id,
                tier_order: tier.tier_order,
                min_order_value: tier.min_order_value,
                discount_type: tier.discount_type,
                discount_value: tier.discount_value,
              }))
            );
          }
        }

        // Delete and recreate rules
        await supabase.from("discount_rules").delete().eq("discount_id", discountToEdit.id);

        if (rules?.length > 0) {
          await supabase.from("discount_rules").insert(
            rules.map((rule: any) => ({
              discount_id: discountToEdit.id,
              rule_type: rule.rule_type,
              rule_value: rule.rule_value,
              discount_type: rule.discount_type,
              discount_value: rule.discount_value,
            }))
          );
        }

        toast({
          title: "Discount Updated",
          description: "Automatic discount has been updated successfully",
        });
      } else {
        // Create new discount
        const { data: newDiscount, error } = await supabase
          .from("automatic_discounts")
          .insert(discount)
          .select()
          .single();

        if (error) throw error;

        // Add tiers
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

        // Add rules
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
          title: "Discount Created",
          description: `Discount "${newDiscount.rule_name}" has been created successfully`,
        });
      }

      setDiscountToEdit(null);
      await loadDiscounts();
      await loadStats();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save discount",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDiscount = async (discountId: string) => {
    if (!confirm("Are you sure you want to delete this discount?")) return;

    try {
      const { error } = await supabase
        .from("automatic_discounts")
        .delete()
        .eq("id", discountId);

      if (error) throw error;

      toast({
        title: "Discount Deleted",
        description: "Automatic discount has been deleted successfully",
      });

      await loadDiscounts();
      await loadStats();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete discount",
      });
    }
  };

  const handleDuplicateDiscount = async (discount: AutoDiscount) => {
    try {
      const { error: discountError } = await supabase.from("automatic_discounts").insert({
        ...discount,
        id: undefined,
        rule_name: `${discount.rule_name} (Copy)`,
        created_at: undefined,
        updated_at: undefined,
      });

      if (discountError) throw discountError;

      toast({
        title: "Discount Duplicated",
        description: `New discount created: "${discount.rule_name} (Copy)"`,
      });

      await loadDiscounts();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to duplicate discount",
      });
    }
  };

  const toggleDiscountStatus = async (discount: AutoDiscount) => {
    try {
      const newStatus = discount.status === "active" ? "disabled" : "active";
      const { error } = await supabase
        .from("automatic_discounts")
        .update({ status: newStatus })
        .eq("id", discount.id);

      if (error) throw error;

      toast({
        title: "Discount Updated",
        description: `Discount has been ${newStatus}`,
      });

      await loadDiscounts();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update discount",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400";
      case "disabled":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
    }
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

  const paginatedDiscounts = filteredDiscounts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(filteredDiscounts.length / itemsPerPage);

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-6 h-6" />
              Automatic Discounts
            </h1>
            <p className="text-muted-foreground mt-1">
              Create automatic discount rules that apply based on cart conditions
            </p>
          </div>
          <Button
            onClick={() => {
              setDiscountToEdit(null);
              setShowCreateModal(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Discount
          </Button>
        </div>

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
              <div className="text-2xl font-bold">{stats.totalRules}</div>
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
                {stats.activeRules}
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
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Discounts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Automatic Discount Rules</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredDiscounts.length === 0 ? (
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
                      {paginatedDiscounts.map((discount) => (
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
                                    setDiscountToEdit(discount);
                                    setShowCreateModal(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDuplicateDiscount(discount)}
                                >
                                  <Copy className="w-4 h-4 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => toggleDiscountStatus(discount)}
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  {discount.status === "active" ? "Disable" : "Enable"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteDiscount(discount.id)}
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

      {/* Create Auto Discount Modal */}
      <CreateAutoDiscountModal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setDiscountToEdit(null);
        }}
        onSave={handleCreateDiscount}
        storeId={storeId}
        discountToEdit={discountToEdit}
      />
    </>
  );
};

export default AutomaticDiscount;
