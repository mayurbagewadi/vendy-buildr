import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RenewSubscriptionModalProps {
  subscription: any;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RenewSubscriptionModal({
  subscription,
  open,
  onClose,
  onSuccess,
}: RenewSubscriptionModalProps) {
  const [loading, setLoading] = useState(false);
  const [resetCounters, setResetCounters] = useState(true);

  const handleRenew = async () => {
    try {
      setLoading(true);

      // Debug: Log subscription object
      console.log('Subscription object:', subscription);
      console.log('Subscription ID:', subscription?.id);

      if (!subscription?.id) {
        throw new Error('Subscription ID is missing. Please refresh the page and try again.');
      }

      // Calculate new period dates
      const newPeriodStart = new Date();
      const newPeriodEnd = new Date();

      if (subscription.billing_cycle === 'yearly') {
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
      } else {
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
      }

      // Direct database update (workaround for PostgREST cache issue with RPC)
      const updateData: any = {
        status: 'active',
        current_period_start: newPeriodStart.toISOString(),
        current_period_end: newPeriodEnd.toISOString(),
        next_billing_at: newPeriodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Conditionally reset counters based on toggle
      if (resetCounters) {
        updateData.whatsapp_orders_used = 0;
        updateData.website_orders_used = 0;
      }

      const { error } = await supabase
        .from('subscriptions')
        .update(updateData)
        .eq('id', subscription.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subscription renewed successfully",
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error renewing subscription:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to renew subscription",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!subscription) return null;

  const isExpired = subscription.status === 'expired' || subscription.status === 'pending_payment';
  const currentOrders = {
    whatsapp: subscription.whatsapp_orders_used || 0,
    website: subscription.website_orders_used || 0,
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Renew Subscription</DialogTitle>
          <DialogDescription>
            Manually renew the subscription for this user
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Subscription Info */}
          <Alert className={isExpired ? "border-red-500" : ""}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Plan:</span>
                  <span>{subscription.plan?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Status:</span>
                  <span className="capitalize">{subscription.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Current Period End:</span>
                  <span>
                    {subscription.current_period_end
                      ? new Date(subscription.current_period_end).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Order Usage Info */}
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Current Order Usage:</p>
                <div className="flex justify-between text-sm">
                  <span>WhatsApp Orders:</span>
                  <span className="font-mono">{currentOrders.whatsapp}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Website Orders:</span>
                  <span className="font-mono">{currentOrders.website}</span>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Reset Counters Option */}
          <div className="flex items-center justify-between space-x-2 rounded-md border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="reset-counters" className="font-medium">
                Reset Order Counters
              </Label>
              <p className="text-sm text-muted-foreground">
                Reset WhatsApp and Website order counts to 0
              </p>
            </div>
            <Switch
              id="reset-counters"
              checked={resetCounters}
              onCheckedChange={setResetCounters}
            />
          </div>

          {/* Renewal Details */}
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm">
              <p className="font-medium text-green-900 dark:text-green-100 mb-1">
                After Renewal:
              </p>
              <ul className="text-green-800 dark:text-green-200 space-y-1">
                <li>• Status will be set to 'active'</li>
                <li>
                  • New period: {new Date().toLocaleDateString()} -{" "}
                  {subscription.billing_cycle === "yearly"
                    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString()
                    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </li>
                {resetCounters && <li>• Order counters will be reset to 0</li>}
                {!resetCounters && <li>• Order counters will remain unchanged</li>}
              </ul>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleRenew} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Renew Subscription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
