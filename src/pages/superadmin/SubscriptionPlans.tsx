import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PlanFormDialog } from "@/components/superadmin/PlanFormDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthly_price: number;
  yearly_price: number;
  max_products: number;
  whatsapp_orders_limit: number | null;
  website_orders_limit: number | null;
  is_active: boolean;
  is_popular: boolean;
  badge_text: string;
  badge_color: string;
  enable_location_sharing: boolean;
  enable_analytics: boolean;
}

const SubscriptionPlansPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const superAdminSession = sessionStorage.getItem('superadmin_session');
      if (superAdminSession) {
        fetchPlans();
        return;
      }

      // Check Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/superadmin/login');
        return;
      }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin');

      if (!roles || roles.length === 0) {
        navigate('/superadmin/login');
        return;
      }

      fetchPlans();
    };

    checkAuth();
  }, [navigate]);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load subscription plans",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handleAddPlan = () => {
    setDialogMode("add");
    setSelectedPlan(null);
    setDialogOpen(true);
  };

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setDialogMode("edit");
    // Add enable toggles based on whether limits exist
    const planWithToggle = {
      ...plan,
      enable_whatsapp_orders: plan.whatsapp_orders_limit !== null,
      enable_website_orders: plan.website_orders_limit !== null,
    };
    setSelectedPlan(planWithToggle as any);
    setDialogOpen(true);
  };

  const handleDeleteClick = (planId: string) => {
    setPlanToDelete(planId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!planToDelete) return;

    try {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', planToDelete);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Plan deleted successfully",
      });
      fetchPlans();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete plan",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
    }
  };

  const handleFormSubmit = async (values: any) => {
    try {
      // If orders limits are disabled, set to null
      const submitData = {
        ...values,
        whatsapp_orders_limit: values.enable_whatsapp_orders ? values.whatsapp_orders_limit : null,
        website_orders_limit: values.enable_website_orders ? values.website_orders_limit : null,
      };
      
      // Remove the enable fields as they're not in the database
      delete submitData.enable_whatsapp_orders;
      delete submitData.enable_website_orders;

      if (dialogMode === "add") {
        const { error } = await supabase
          .from('subscription_plans')
          .insert([submitData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Plan created successfully",
        });
      } else if (selectedPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(submitData)
          .eq('id', selectedPlan.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Plan updated successfully",
        });
      }

      setDialogOpen(false);
      fetchPlans();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${dialogMode} plan`,
        variant: "destructive",
      });
    }
  };

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
                onClick={() => navigate('/superadmin/dashboard')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Subscription Plans</h1>
                <p className="text-sm text-muted-foreground">
                  Manage subscription plans and pricing
                </p>
              </div>
            </div>
            <Button onClick={handleAddPlan}>
              <Plus className="mr-2 h-4 w-4" />
              Add Plan
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">Loading plans...</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id} className={plan.is_popular ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{plan.name}</CardTitle>
                      <CardDescription className="mt-2">{plan.description}</CardDescription>
                    </div>
                    {plan.is_popular && (
                      <Badge variant="default">Popular</Badge>
                    )}
                  </div>
                  {plan.badge_text && (
                    <Badge variant="outline" className="w-fit">
                      {plan.badge_text}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-3xl font-bold">{formatPrice(plan.monthly_price)}</p>
                      <p className="text-sm text-muted-foreground">per month</p>
                      {plan.yearly_price && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatPrice(plan.yearly_price)}/year
                        </p>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <p>Max Products: {plan.max_products || 'Unlimited'}</p>
                      <p>WhatsApp Orders: {plan.whatsapp_orders_limit || 'Unlimited'}</p>
                      <p>Website Orders: {plan.website_orders_limit || 'Unlimited'}</p>
                      <p>Status: {plan.is_active ? 'Active' : 'Inactive'}</p>
                      <div className="flex gap-2 mt-2">
                        {plan.enable_location_sharing && (
                          <Badge variant="secondary">Location</Badge>
                        )}
                        {plan.enable_analytics && (
                          <Badge variant="secondary">Analytics</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleEditPlan(plan)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(plan.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <PlanFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleFormSubmit}
        mode={dialogMode}
        defaultValues={selectedPlan || undefined}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this subscription plan? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SubscriptionPlansPage;
