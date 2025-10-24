import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Plan {
  id: string;
  name: string;
  trial_days: number;
}

interface AssignPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  currentSubscription?: {
    plan: { name: string };
    status: string;
  } | null;
  onSuccess: () => void;
}

export function AssignPlanModal({
  open,
  onOpenChange,
  userId,
  userEmail,
  currentSubscription,
  onSuccess,
}: AssignPlanModalProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [status, setStatus] = useState("trial");
  const [trialDays, setTrialDays] = useState(14);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadPlans();
    }
  }, [open]);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, name, trial_days")
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      setPlans(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = plans.find((p) => p.id === planId);
    if (plan) {
      setTrialDays(plan.trial_days || 14);
    }
  };

  const handleAssign = async () => {
    if (!selectedPlanId) {
      toast({
        title: "Error",
        description: "Please select a plan",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const now = new Date();
      
      // Calculate current period end based on billing cycle and status
      let currentPeriodEnd = new Date();
      if (status === "trial") {
        // For trial, current period ends when trial ends
        currentPeriodEnd.setDate(currentPeriodEnd.getDate() + trialDays);
      } else if (status === "active") {
        // For active, set based on billing cycle
        if (billingCycle === "monthly") {
          currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
        } else {
          currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
        }
      } else {
        // For expired/cancelled, set to past date
        currentPeriodEnd = new Date(now.getTime() - 86400000); // Yesterday
      }

      // Calculate trial end date
      const trialEndsAt = status === "trial" 
        ? new Date(now.getTime() + trialDays * 86400000) 
        : null;

      // Calculate next billing date
      const nextBillingAt = status === "active" 
        ? new Date(currentPeriodEnd.getTime()) 
        : null;

      // Check if subscription exists
      const { data: existing } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      const subscriptionData = {
        plan_id: selectedPlanId,
        billing_cycle: billingCycle,
        status: status,
        current_period_start: now.toISOString(),
        current_period_end: currentPeriodEnd.toISOString(),
        trial_ends_at: trialEndsAt?.toISOString() || null,
        next_billing_at: nextBillingAt?.toISOString() || null,
        started_at: now.toISOString(),
      };

      if (existing) {
        // Update existing subscription
        const { error } = await supabase
          .from("subscriptions")
          .update({
            ...subscriptionData,
            updated_at: now.toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Create new subscription
        const { error } = await supabase.from("subscriptions").insert({
          user_id: userId,
          ...subscriptionData,
        });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Subscription plan assigned to ${userEmail}`,
      });

      onSuccess();
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Subscription Plan</DialogTitle>
          <DialogDescription>
            Assign or update subscription plan for {userEmail}
            {currentSubscription && (
              <span className="block mt-2 text-sm">
                Current: {currentSubscription.plan.name} ({currentSubscription.status})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Plan</Label>
            <Select value={selectedPlanId} onValueChange={handlePlanChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Billing Cycle</Label>
            <Select value={billingCycle} onValueChange={setBillingCycle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === "trial" && (
            <div className="space-y-2">
              <Label>Trial Days</Label>
              <Input
                type="number"
                value={trialDays}
                onChange={(e) => setTrialDays(parseInt(e.target.value))}
                min={0}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={loading}>
            {loading ? "Assigning..." : "Assign Plan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
