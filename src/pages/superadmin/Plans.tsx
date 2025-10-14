import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Trash2, Copy, Users, Plus, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import SuperAdminLayout from "@/components/superadmin/SuperAdminLayout";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: number;
  yearly_price: number | null;
  max_products: number | null;
  trial_days: number | null;
  features: any;
  is_active: boolean;
  is_popular: boolean;
  badge_text: string | null;
  badge_color: string | null;
  display_order: number | null;
}

export default function SubscriptionPlans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState<Partial<Plan>>({
    name: "",
    slug: "",
    description: "",
    monthly_price: 0,
    yearly_price: null,
    max_products: null,
    trial_days: 14,
    features: [],
    is_active: true,
    is_popular: false,
    badge_text: null,
    badge_color: null,
    display_order: 0,
  });

  useEffect(() => {
    // Check super admin auth
    const session = sessionStorage.getItem('superadmin_session');
    if (!session) {
      navigate('/superadmin/login');
      return;
    }
    fetchPlans();
  }, [navigate]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setPlans(data || []);
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

  const handleCreateNew = () => {
    setSelectedPlan(null);
    setFormData({
      name: "",
      slug: "",
      description: "",
      monthly_price: 0,
      yearly_price: null,
      max_products: null,
      trial_days: 14,
      features: [],
      is_active: true,
      is_popular: false,
      badge_text: null,
      badge_color: null,
      display_order: plans.length,
    });
    setShowModal(true);
  };

  const handleEdit = (plan: Plan) => {
    setSelectedPlan(plan);
    setFormData(plan);
    setShowModal(true);
  };

  const handleDuplicate = (plan: Plan) => {
    setSelectedPlan(null);
    setFormData({
      ...plan,
      id: undefined,
      name: `${plan.name} (Copy)`,
      slug: `${plan.slug}-copy`,
      is_active: false,
    });
    setShowModal(true);
  };

  const handleDelete = (plan: Plan) => {
    setSelectedPlan(plan);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!selectedPlan) return;

    try {
      const { error } = await supabase
        .from("subscription_plans")
        .delete()
        .eq("id", selectedPlan.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Plan deleted successfully",
      });
      fetchPlans();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setShowDeleteDialog(false);
      setSelectedPlan(null);
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.slug) {
        toast({
          title: "Validation Error",
          description: "Name and slug are required",
          variant: "destructive",
        });
        return;
      }

      if (selectedPlan) {
        // Update existing plan
        const { error } = await supabase
          .from("subscription_plans")
          .update(formData as any)
          .eq("id", selectedPlan.id);

        if (error) throw error;
      } else {
        // Create new plan
        const { error } = await supabase
          .from("subscription_plans")
          .insert([formData as any]);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Plan ${selectedPlan ? 'updated' : 'created'} successfully`,
      });
      
      setShowModal(false);
      fetchPlans();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  return (
    <SuperAdminLayout>
      <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Manage Subscription Plans</h1>
          <p className="text-sm md:text-base text-muted-foreground">Create and manage pricing plans for your platform</p>
        </div>
        <Button onClick={handleCreateNew} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Create New Plan
        </Button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {loading ? (
          <p className="col-span-full text-center py-8">Loading plans...</p>
        ) : plans.length === 0 ? (
          <p className="col-span-full text-center py-8 text-muted-foreground">No plans found</p>
        ) : (
          plans.map((plan) => (
            <Card key={plan.id} className="relative">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    {plan.badge_text && (
                      <Badge className={plan.badge_color || "bg-primary"}>
                        {plan.badge_text}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(plan)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {plan.slug !== "free" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(plan)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-3xl font-bold">
                    ₹{plan.monthly_price.toLocaleString()} / month
                  </div>
                  {plan.yearly_price && (
                    <div className="text-sm text-muted-foreground">
                      ₹{plan.yearly_price.toLocaleString()} / year
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <p><strong>Products:</strong> {plan.max_products || "Unlimited"}</p>
                  <p><strong>Trial:</strong> {plan.trial_days || 0} days</p>
                  <div className="flex items-center gap-2">
                    <strong>Status:</strong>
                    <div className={`h-2 w-2 rounded-full ${plan.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {plan.is_active ? "Active" : "Inactive"}
                  </div>
                </div>

                <div className="space-y-2">
                  <strong className="text-sm">Features:</strong>
                  <ul className="space-y-1 text-sm">
                    {(plan.features as string[])?.slice(0, 4).map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="text-green-500">✓</span>
                        {feature}
                      </li>
                    ))}
                    {(plan.features as string[])?.length > 4 && (
                      <li className="text-muted-foreground">
                        +{(plan.features as string[]).length - 4} more
                      </li>
                    )}
                  </ul>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {/* View users on this plan */}}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    View Users
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDuplicate(plan)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPlan ? 'Edit Plan' : 'Create New Plan'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Details */}
            <div className="space-y-4">
              <h3 className="font-semibold">Basic Details</h3>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="name">Plan Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        name: e.target.value,
                        slug: generateSlug(e.target.value),
                      });
                    }}
                    placeholder="e.g., Startup, Business, Professional"
                  />
                </div>
                <div>
                  <Label htmlFor="slug">Plan Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="auto-generated-slug"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="For marketing/display purposes"
                  />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="font-semibold">Pricing</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="monthly">Monthly Price (₹) *</Label>
                  <Input
                    id="monthly"
                    type="number"
                    value={formData.monthly_price}
                    onChange={(e) => setFormData({ ...formData, monthly_price: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="yearly">Yearly Price (₹)</Label>
                  <Input
                    id="yearly"
                    type="number"
                    value={formData.yearly_price || ""}
                    onChange={(e) => setFormData({ ...formData, yearly_price: parseInt(e.target.value) || null })}
                  />
                </div>
              </div>
            </div>

            {/* Limits & Trial */}
            <div className="space-y-4">
              <h3 className="font-semibold">Limits & Trial</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="products">Max Products</Label>
                  <Input
                    id="products"
                    type="number"
                    value={formData.max_products || ""}
                    onChange={(e) => setFormData({ ...formData, max_products: parseInt(e.target.value) || null })}
                    placeholder="Leave empty for unlimited"
                  />
                </div>
                <div>
                  <Label htmlFor="trial">Trial Days</Label>
                  <Input
                    id="trial"
                    type="number"
                    value={formData.trial_days || 0}
                    onChange={(e) => setFormData({ ...formData, trial_days: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            {/* Display Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold">Display Settings</h3>
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="active">Active Plan</Label>
                  <Switch
                    id="active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="popular">Mark as Most Popular</Label>
                  <Switch
                    id="popular"
                    checked={formData.is_popular}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_popular: checked })}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="badge">Badge Text</Label>
                    <Input
                      id="badge"
                      value={formData.badge_text || ""}
                      onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })}
                      placeholder="e.g., Best Value"
                    />
                  </div>
                  <div>
                    <Label htmlFor="order">Display Order</Label>
                    <Input
                      id="order"
                      type="number"
                      value={formData.display_order || 0}
                      onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSave} className="w-full sm:w-auto">
              {selectedPlan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedPlan?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Users currently on this plan will keep their subscription.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </SuperAdminLayout>
  );
}
