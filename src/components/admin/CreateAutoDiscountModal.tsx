import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { type AutoDiscount } from "@/lib/autoDiscountUtils";
import { Loader2, Plus, X } from "lucide-react";

interface CreateAutoDiscountModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (discount: Partial<AutoDiscount> & { tiers?: any[]; rules?: any[] }) => Promise<void>;
  storeId: string;
  discountToEdit?: AutoDiscount | null;
}

interface Tier {
  id?: string;
  tier_order: number;
  min_order_value?: number;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
}

interface Rule {
  id?: string;
  rule_type: string;
  rule_value: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
}

export function CreateAutoDiscountModal({
  open,
  onClose,
  onSave,
  storeId,
  discountToEdit,
}: CreateAutoDiscountModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  const [formData, setFormData] = useState<Partial<AutoDiscount>>({
    rule_name: "",
    rule_description: "",
    rule_type: "tiered_value",
    order_type: "all",
    status: "active",
    start_date: new Date().toISOString().split("T")[0],
    expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  });

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);

  useEffect(() => {
    if (open) {
      loadCategories();

      if (discountToEdit) {
        setFormData({
          rule_name: discountToEdit.rule_name,
          rule_description: discountToEdit.rule_description,
          rule_type: discountToEdit.rule_type,
          order_type: discountToEdit.order_type,
          status: discountToEdit.status,
          start_date: discountToEdit.start_date.split("T")[0],
          expiry_date: discountToEdit.expiry_date.split("T")[0],
        });

        // Load tiers and rules if editing
        loadTiersAndRules();
      } else {
        setFormData({
          rule_name: "",
          rule_description: "",
          rule_type: "tiered_value",
          order_type: "all",
          status: "active",
          start_date: new Date().toISOString().split("T")[0],
          expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        });
        setTiers([]);
        setRules([]);
      }
    }
  }, [open, discountToEdit]);

  const loadCategories = async () => {
    try {
      const { data } = await supabase
        .from("categories")
        .select("id, name")
        .eq("store_id", storeId)
        .order("name");
      if (data) setCategories(data);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const loadTiersAndRules = async () => {
    if (!discountToEdit) return;

    try {
      // Load tiers for tiered discounts
      if (discountToEdit.rule_type === "tiered_value") {
        const { data: tierData } = await supabase
          .from("discount_tiers")
          .select("*")
          .eq("discount_id", discountToEdit.id)
          .order("tier_order");
        if (tierData) setTiers(tierData as Tier[]);
      }

      // Load rules for other discount types
      if (["new_customer", "returning_customer", "category", "quantity"].includes(discountToEdit.rule_type)) {
        const { data: ruleData } = await supabase
          .from("discount_rules")
          .select("*")
          .eq("discount_id", discountToEdit.id);
        if (ruleData) setRules(ruleData as Rule[]);
      }
    } catch (error) {
      console.error("Error loading tiers/rules:", error);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!formData.rule_name || formData.rule_name.trim() === "") {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Rule name is required",
      });
      return;
    }

    if (formData.rule_type === "tiered_value" && tiers.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please add at least one tier",
      });
      return;
    }

    if (["new_customer", "returning_customer"].includes(formData.rule_type || "") && rules.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please set discount amount",
      });
      return;
    }

    if (formData.rule_type === "category" && rules.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select at least one category",
      });
      return;
    }

    if (formData.rule_type === "quantity" && rules.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please set quantity and discount",
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

    setIsSaving(true);
    try {
      await onSave({
        ...formData,
        store_id: storeId,
        tiers,
        rules,
      } as any);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const addTier = () => {
    const newTier: Tier = {
      tier_order: tiers.length + 1,
      discount_type: "percentage",
      discount_value: 0,
    };
    setTiers([...tiers, newTier]);
  };

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: string, value: any) => {
    const updated = [...tiers];
    (updated[index] as any)[field] = value;
    setTiers(updated);
  };

  const addRule = () => {
    const newRule: Rule = {
      rule_type: formData.rule_type === "category" ? "category_id" : "min_quantity",
      rule_value: "",
      discount_type: "percentage",
      discount_value: 0,
    };
    setRules([...rules, newRule]);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, field: string, value: any) => {
    const updated = [...rules];
    (updated[index] as any)[field] = value;
    setRules(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{discountToEdit ? "Edit Automatic Discount" : "Create Automatic Discount"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="discount">Discount</TabsTrigger>
            <TabsTrigger value="payment">Payment</TabsTrigger>
            <TabsTrigger value="validity">Validity</TabsTrigger>
          </TabsList>

          {/* Basic Tab */}
          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ruleName">Rule Name</Label>
              <Input
                id="ruleName"
                value={formData.rule_name || ""}
                onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                placeholder="e.g., Order Volume Discount"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.rule_description || ""}
                onChange={(e) => setFormData({ ...formData, rule_description: e.target.value })}
                placeholder="Describe this discount rule"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ruleType">Discount Type</Label>
              <Select
                value={formData.rule_type}
                onValueChange={(value) => {
                  setFormData({ ...formData, rule_type: value as any });
                  setTiers([]);
                  setRules([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tiered_value">Tiered by Order Value</SelectItem>
                  <SelectItem value="new_customer">New Customer Discount</SelectItem>
                  <SelectItem value="returning_customer">Returning Customer Bonus</SelectItem>
                  <SelectItem value="category">Specific Category</SelectItem>
                  <SelectItem value="quantity">Quantity Based</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose when this discount applies
              </p>
            </div>
          </TabsContent>

          {/* Discount Tab */}
          <TabsContent value="discount" className="space-y-4">
            {/* Tiered Discount */}
            {formData.rule_type === "tiered_value" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Discount Tiers</Label>
                  <Button size="sm" variant="outline" onClick={addTier}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Tier
                  </Button>
                </div>

                {tiers.map((tier, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-3 relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => removeTier(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Minimum Order Value (₹)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="10"
                          value={tier.min_order_value || ""}
                          onChange={(e) =>
                            updateTier(index, "min_order_value", parseFloat(e.target.value) || undefined)
                          }
                          placeholder="500"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={tier.discount_type}
                          onValueChange={(value) =>
                            updateTier(index, "discount_type", value as 'percentage' | 'flat')
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

                      <div className="space-y-1">
                        <Label className="text-xs">Value</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={tier.discount_value || ""}
                          onChange={(e) =>
                            updateTier(index, "discount_value", parseFloat(e.target.value) || 0)
                          }
                          placeholder={tier.discount_type === "percentage" ? "10" : "100"}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* New Customer / Returning Customer Discount */}
            {["new_customer", "returning_customer"].includes(formData.rule_type || "") && (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Discount Type</Label>
                      <Select
                        value={rules[0]?.discount_type || "percentage"}
                        onValueChange={(value) =>
                          updateRule(0, "discount_type", value as 'percentage' | 'flat')
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

                    <div className="space-y-1">
                      <Label className="text-xs">Discount Value</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rules[0]?.discount_value || ""}
                        onChange={(e) =>
                          rules.length === 0
                            ? addRule()
                            : updateRule(0, "discount_value", parseFloat(e.target.value) || 0)
                        }
                        placeholder={rules[0]?.discount_type === "percentage" ? "15" : "200"}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category Discount */}
            {formData.rule_type === "category" && (
              <div className="space-y-4">
                <Label>Select Categories</Label>
                <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                  {categories.map((category) => (
                    <div key={category.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`cat-${category.id}`}
                        checked={rules.some(r => r.rule_value === category.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            const newRule: Rule = {
                              rule_type: "category_id",
                              rule_value: category.id,
                              discount_type: "percentage",
                              discount_value: 5,
                            };
                            setRules([...rules, newRule]);
                          } else {
                            setRules(rules.filter(r => r.rule_value !== category.id));
                          }
                        }}
                      />
                      <Label htmlFor={`cat-${category.id}`} className="cursor-pointer">
                        {category.name}
                      </Label>
                    </div>
                  ))}
                </div>

                {rules.length > 0 && (
                  <div className="p-3 border rounded-lg space-y-2">
                    <Label className="text-sm">Discount for Selected Categories</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Select
                        value={rules[0]?.discount_type}
                        onValueChange={(value) =>
                          updateRule(0, "discount_type", value as 'percentage' | 'flat')
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
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rules[0]?.discount_value || ""}
                        onChange={(e) => updateRule(0, "discount_value", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quantity Discount */}
            {formData.rule_type === "quantity" && (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Minimum Items</Label>
                      <Input
                        type="number"
                        min="1"
                        value={rules[0]?.rule_value || ""}
                        onChange={(e) =>
                          rules.length === 0
                            ? (() => {
                                const newRule: Rule = {
                                  rule_type: "min_quantity",
                                  rule_value: e.target.value,
                                  discount_type: "percentage",
                                  discount_value: 0,
                                };
                                setRules([newRule]);
                              })()
                            : updateRule(0, "rule_value", e.target.value)
                        }
                        placeholder="3"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={rules[0]?.discount_type || "percentage"}
                        onValueChange={(value) =>
                          updateRule(0, "discount_type", value as 'percentage' | 'flat')
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

                    <div className="space-y-1">
                      <Label className="text-xs">Value</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rules[0]?.discount_value || ""}
                        onChange={(e) =>
                          updateRule(0, "discount_value", parseFloat(e.target.value) || 0)
                        }
                        placeholder="10"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Payment Tab */}
          <TabsContent value="payment" className="space-y-4">
            <Label>Apply To</Label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="all"
                  name="order_type"
                  value="all"
                  checked={formData.order_type === "all"}
                  onChange={(e) => setFormData({ ...formData, order_type: e.target.value as any })}
                  className="cursor-pointer"
                />
                <Label htmlFor="all" className="cursor-pointer">
                  All Payment Methods (Online & COD)
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="online"
                  name="order_type"
                  value="online"
                  checked={formData.order_type === "online"}
                  onChange={(e) => setFormData({ ...formData, order_type: e.target.value as any })}
                  className="cursor-pointer"
                />
                <Label htmlFor="online" className="cursor-pointer">
                  Online Payment Only (Razorpay, PhonePe)
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="cod"
                  name="order_type"
                  value="cod"
                  checked={formData.order_type === "cod"}
                  onChange={(e) => setFormData({ ...formData, order_type: e.target.value as any })}
                  className="cursor-pointer"
                />
                <Label htmlFor="cod" className="cursor-pointer">
                  Cash on Delivery Only
                </Label>
              </div>
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
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={formData.expiry_date || ""}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
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
            ) : discountToEdit ? (
              "Update Discount"
            ) : (
              "Create Discount"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
