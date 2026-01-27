import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateCouponCode, type Coupon } from "@/lib/couponUtils";
import { Loader2, RefreshCw } from "lucide-react";

interface CreateCouponModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (coupon: Partial<Coupon>) => Promise<void>;
  storeId: string;
  couponToEdit?: Coupon | null;
}

export function CreateCouponModal({
  open,
  onClose,
  onSave,
  storeId,
  couponToEdit,
}: CreateCouponModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [formData, setFormData] = useState<Partial<Coupon>>({
    code: generateCouponCode(),
    description: "",
    discount_type: "percentage",
    discount_value: 0,
    max_discount: undefined,
    min_order_value: undefined,
    start_date: new Date().toISOString().split("T")[0],
    expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    usage_limit_total: undefined,
    usage_limit_per_customer: undefined,
    applicable_to: "all",
    customer_type: "all",
    is_first_order: false,
    order_type: "all",
    status: "active",
  });

  useEffect(() => {
    if (open) {
      loadProducts();
      loadCategories();

      if (couponToEdit) {
        setFormData({
          ...couponToEdit,
          start_date: couponToEdit.start_date.split("T")[0],
          expiry_date: couponToEdit.expiry_date.split("T")[0],
        });

        // Load associated products and categories
        loadCouponProducts();
        loadCouponCategories();
      } else {
        setFormData({
          code: generateCouponCode(),
          description: "",
          discount_type: "percentage",
          discount_value: 0,
          max_discount: undefined,
          min_order_value: undefined,
          start_date: new Date().toISOString().split("T")[0],
          expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          usage_limit_total: undefined,
          usage_limit_per_customer: undefined,
          applicable_to: "all",
          customer_type: "all",
          is_first_order: false,
          order_type: "all",
          status: "active",
        });
        setSelectedProducts([]);
        setSelectedCategories([]);
      }
    }
  }, [open, couponToEdit]);

  const loadProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name")
      .eq("store_id", storeId)
      .order("name");
    if (data) setProducts(data);
  };

  const loadCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("id, name")
      .eq("store_id", storeId)
      .order("name");
    if (data) setCategories(data);
  };

  const loadCouponProducts = async () => {
    if (!couponToEdit) return;
    const { data } = await supabase
      .from("coupon_products")
      .select("product_id")
      .eq("coupon_id", couponToEdit.id)
      .eq("is_excluded", false);
    if (data) setSelectedProducts(data.map((d) => d.product_id));
  };

  const loadCouponCategories = async () => {
    if (!couponToEdit) return;
    const { data } = await supabase
      .from("coupon_categories")
      .select("category_id")
      .eq("coupon_id", couponToEdit.id);
    if (data) setSelectedCategories(data.map((d) => d.category_id));
  };

  const handleSave = async () => {
    // Validation
    if (!formData.code || formData.code.trim() === "") {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Coupon code is required",
      });
      return;
    }

    if (!formData.discount_value || formData.discount_value <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Discount value must be greater than 0",
      });
      return;
    }

    if (formData.discount_type === "percentage" && formData.discount_value > 100) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Percentage discount cannot exceed 100%",
      });
      return;
    }

    if (new Date(formData.start_date!) > new Date(formData.expiry_date!)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Expiry date must be after start date",
      });
      return;
    }

    if (formData.applicable_to === "products" && selectedProducts.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select at least one product",
      });
      return;
    }

    if (formData.applicable_to === "categories" && selectedCategories.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select at least one category",
      });
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        ...formData,
        store_id: storeId,
        selectedProducts,
        selectedCategories,
      } as any);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{couponToEdit ? "Edit Coupon" : "Create New Coupon"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="validity">Validity</TabsTrigger>
            <TabsTrigger value="targeting">Targeting</TabsTrigger>
            <TabsTrigger value="conditions">Conditions</TabsTrigger>
          </TabsList>

          {/* Basic Tab */}
          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Coupon Code</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  value={formData.code || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="SUMMER20"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      code: generateCouponCode(),
                    })
                  }
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Auto-generated or enter custom code (alphanumeric only)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Summer sale coupon - 20% off"
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discountType">Discount Type</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      discount_type: value as "percentage" | "flat",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="flat">Flat (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discountValue">
                  Discount Value {formData.discount_type === "percentage" ? "(%)" : "(₹)"}
                </Label>
                <Input
                  id="discountValue"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.discount_value || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      discount_value: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            {formData.discount_type === "percentage" && (
              <div className="space-y-2">
                <Label htmlFor="maxDiscount">Maximum Discount Cap (Optional, ₹)</Label>
                <Input
                  id="maxDiscount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="500"
                  value={formData.max_discount || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_discount: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Maximum discount amount for percentage-based coupons
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="minOrderValue">Minimum Order Value (Optional, ₹)</Label>
              <Input
                id="minOrderValue"
                type="number"
                min="0"
                step="0.01"
                placeholder="1000"
                value={formData.min_order_value || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    min_order_value: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </TabsContent>

          {/* Validity Tab */}
          <TabsContent value="validity" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.start_date || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={formData.expiry_date || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, expiry_date: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="usageLimitTotal">Total Usage Limit (Optional)</Label>
              <Input
                id="usageLimitTotal"
                type="number"
                min="1"
                placeholder="100"
                value={formData.usage_limit_total || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    usage_limit_total: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Maximum times this coupon can be used in total
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="usageLimitPerCustomer">
                Usage Limit Per Customer (Optional)
              </Label>
              <Input
                id="usageLimitPerCustomer"
                type="number"
                min="1"
                placeholder="1"
                value={formData.usage_limit_per_customer || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    usage_limit_per_customer: e.target.value
                      ? parseInt(e.target.value)
                      : undefined,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Maximum times a single customer can use this coupon
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value as any })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Targeting Tab */}
          <TabsContent value="targeting" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="applicableTo">Applicable To</Label>
              <Select
                value={formData.applicable_to}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    applicable_to: value as any,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="products">Specific Products</SelectItem>
                  <SelectItem value="categories">Specific Categories</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.applicable_to === "products" && (
              <div className="space-y-2">
                <Label>Select Products</Label>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`product-${product.id}`}
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedProducts([
                              ...selectedProducts,
                              product.id,
                            ]);
                          } else {
                            setSelectedProducts(
                              selectedProducts.filter(
                                (id) => id !== product.id
                              )
                            );
                          }
                        }}
                      />
                      <Label
                        htmlFor={`product-${product.id}`}
                        className="cursor-pointer"
                      >
                        {product.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formData.applicable_to === "categories" && (
              <div className="space-y-2">
                <Label>Select Categories</Label>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {categories.map((category) => (
                    <div key={category.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`category-${category.id}`}
                        checked={selectedCategories.includes(category.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedCategories([
                              ...selectedCategories,
                              category.id,
                            ]);
                          } else {
                            setSelectedCategories(
                              selectedCategories.filter(
                                (id) => id !== category.id
                              )
                            );
                          }
                        }}
                      />
                      <Label
                        htmlFor={`category-${category.id}`}
                        className="cursor-pointer"
                      >
                        {category.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="customerType">Customer Type</Label>
              <Select
                value={formData.customer_type}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    customer_type: value as any,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="new">New Customers Only</SelectItem>
                  <SelectItem value="returning">Returning Customers Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isFirstOrder"
                checked={formData.is_first_order}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    is_first_order: checked as boolean,
                  })
                }
              />
              <Label htmlFor="isFirstOrder" className="cursor-pointer">
                First Order Only
              </Label>
            </div>
          </TabsContent>

          {/* Conditions Tab */}
          <TabsContent value="conditions" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orderType">Order Type</Label>
              <Select
                value={formData.order_type}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    order_type: value as any,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="online">Online Payment Only</SelectItem>
                  <SelectItem value="cod">Cash on Delivery Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
              <p className="font-medium text-sm">Coupon Summary</p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>
                  • {formData.discount_type === "percentage" ? "%" : "₹"}
                  {formData.discount_value} discount
                  {formData.discount_type === "percentage" &&
                    formData.max_discount &&
                    ` (max ₹${formData.max_discount})`}
                </li>
                {formData.min_order_value && (
                  <li>• Minimum order: ₹{formData.min_order_value}</li>
                )}
                <li>• Valid from {formData.start_date} to {formData.expiry_date}</li>
                <li>• Applicable to: {formData.applicable_to}</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : couponToEdit ? (
              "Update Coupon"
            ) : (
              "Create Coupon"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
