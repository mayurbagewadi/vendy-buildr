import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PlanFormDialog } from "@/components/superadmin/PlanFormDialog";
import { ThemeToggle } from "@/components/ui/theme-toggle";
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
  enable_custom_domain: boolean;
  enable_ai_voice: boolean;
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
  const [activeSubscribersCount, setActiveSubscribersCount] = useState<number>(0);
  const [checkingSubscribers, setCheckingSubscribers] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      // Check Supabase auth first (faster than sessionStorage check)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const superAdminSession = sessionStorage.getItem('superadmin_session');
        if (!superAdminSession) {
          navigate('/superadmin/login');
          return;
        }
      }

      if (user) {
        // Verify super admin role
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'super_admin');

        if (!roles || roles.length === 0) {
          navigate('/superadmin/login');
          return;
        }
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

  const handleDeleteClick = async (planId: string) => {
    setPlanToDelete(planId);
    setCheckingSubscribers(true);
    setDeleteDialogOpen(true);

    try {
      // Count active subscriptions for this plan
      const { count, error } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('plan_id', planId)
        .in('status', ['active', 'trial']);

      if (error) throw error;
      setActiveSubscribersCount(count || 0);
    } catch (error) {
      console.error('Error checking active subscribers:', error);
      setActiveSubscribersCount(0);
    } finally {
      setCheckingSubscribers(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!planToDelete) return;

    // Prevent deletion if there are active subscribers
    if (activeSubscribersCount > 0) {
      toast({
        title: "Cannot Delete Plan",
        description: `This plan has ${activeSubscribersCount} active subscriber${activeSubscribersCount > 1 ? 's' : ''}. Please deactivate the plan instead or migrate users to another plan first.`,
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', planToDelete);

      if (error) throw error;

      // Optimistic update - remove from list immediately
      setPlans(plans.filter(p => p.id !== planToDelete));

      toast({
        title: "Success",
        description: "Plan deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete plan",
        variant: "destructive",
      });
      // On error, refetch to ensure consistency
      fetchPlans();
    } finally {
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
      setActiveSubscribersCount(0);
    }
  };

  const handleFormSubmit = async (values: any) => {
    try {
      // If orders limits are disabled, set to null; if enabled but empty, set to 0 (unlimited)
      const submitData = {
        ...values,
        whatsapp_orders_limit: values.enable_whatsapp_orders 
          ? (values.whatsapp_orders_limit || 0) 
          : null,
        website_orders_limit: values.enable_website_orders 
          ? (values.website_orders_limit || 0) 
          : null,
      };
      
      // Remove the enable fields as they're not in the database
      delete submitData.enable_whatsapp_orders;
      delete submitData.enable_website_orders;

      if (dialogMode === "add") {
        const { data, error } = await supabase
          .from('subscription_plans')
          .insert([submitData])
          .select()
          .single();

        if (error) throw error;

        // Optimistic update - add to list immediately
        setPlans([...plans, data]);
        
        toast({
          title: "Success",
          description: "Plan created successfully",
        });
      } else if (selectedPlan) {
        const { data, error } = await supabase
          .from('subscription_plans')
          .update(submitData)
          .eq('id', selectedPlan.id)
          .select()
          .single();

        if (error) throw error;

        // Optimistic update - update in list immediately
        setPlans(plans.map(p => p.id === selectedPlan.id ? data : p));
        
        toast({
          title: "Success",
          description: "Plan updated successfully",
        });
      }

      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${dialogMode} plan`,
        variant: "destructive",
      });
      // On error, refetch to ensure consistency
      fetchPlans();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Subscription Plans</h1>
                <p className="text-sm text-muted-foreground">
                  Manage subscription plans and pricing
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <Button onClick={handleAddPlan}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Plan
                </Button>
              </div>
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
                      <p>Max Products: {plan.max_products === 0 || plan.max_products === null ? 'Unlimited' : plan.max_products}</p>
                      <p>WhatsApp Orders: {plan.whatsapp_orders_limit === 0 || plan.whatsapp_orders_limit === null ? 'Unlimited' : plan.whatsapp_orders_limit}</p>
                      <p>Website Orders: {plan.website_orders_limit === 0 || plan.website_orders_limit === null ? 'Unlimited' : plan.website_orders_limit}</p>
                      <p>Status: {plan.is_active ? 'Active' : 'Inactive'}</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {plan.enable_location_sharing && (
                          <Badge variant="secondary">Location</Badge>
                        )}
                        {plan.enable_analytics && (
                          <Badge variant="secondary">Analytics</Badge>
                        )}
                        {plan.enable_custom_domain && (
                          <Badge variant="secondary">Custom Domain</Badge>
                        )}
                        {plan.enable_ai_voice && (
                          <Badge variant="secondary">AI Voice</Badge>
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
            <AlertDialogTitle>
              {checkingSubscribers ? "Checking Active Subscribers..." : "Delete Subscription Plan"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {checkingSubscribers ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>Checking for active subscribers...</span>
                </div>
              ) : (
                <>
                  {activeSubscribersCount > 0 ? (
                    <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-4">
                      <p className="font-semibold text-destructive">
                        ⚠️ Cannot Delete This Plan
                      </p>
                      <p className="mt-2 text-sm">
                        This plan currently has{" "}
                        <span className="font-bold">{activeSubscribersCount}</span>{" "}
                        active subscriber{activeSubscribersCount > 1 ? "s" : ""}.
                      </p>
                      <p className="mt-2 text-sm">
                        <strong>Recommended:</strong> Use the "Active" toggle to deactivate this plan instead.
                        This will hide it from new users while keeping existing subscriptions working.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-green-500 bg-green-50 p-4 dark:bg-green-950">
                      <p className="font-semibold text-green-700 dark:text-green-300">
                        ✅ Safe to Delete
                      </p>
                      <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                        This plan has <span className="font-bold">0 active subscribers</span>.
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Are you sure you want to permanently delete this subscription plan? This action cannot be undone.
                      </p>
                    </div>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={checkingSubscribers || activeSubscribersCount > 0}
              className={activeSubscribersCount > 0 ? "bg-gray-400 hover:bg-gray-400" : "bg-destructive hover:bg-destructive/90"}
            >
              {activeSubscribersCount > 0 ? "Cannot Delete" : "Delete Plan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SubscriptionPlansPage;
