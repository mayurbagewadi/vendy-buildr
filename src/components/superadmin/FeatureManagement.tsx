import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface SubscriptionPlan {
  id: string;
  name: string;
  enable_location_sharing: boolean;
  enable_analytics: boolean;
  enable_order_emails: boolean;
}

export function FeatureManagement() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, name, enable_location_sharing, enable_analytics, enable_order_emails")
        .order("display_order");

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

  const toggleFeature = async (
    planId: string,
    feature: "enable_location_sharing" | "enable_analytics" | "enable_order_emails",
    value: boolean
  ) => {
    try {
      const { error } = await supabase
        .from("subscription_plans")
        .update({ [feature]: value })
        .eq("id", planId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Feature setting updated",
      });
      loadPlans();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {plans.map((plan) => (
            <div key={plan.id} className="border rounded-lg p-4">
              <h3 className="font-semibold mb-4">{plan.name}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`location-${plan.id}`} className="cursor-pointer">
                    Location Sharing
                  </Label>
                  <Switch
                    id={`location-${plan.id}`}
                    checked={plan.enable_location_sharing}
                    onCheckedChange={(checked) =>
                      toggleFeature(plan.id, "enable_location_sharing", checked)
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor={`analytics-${plan.id}`} className="cursor-pointer">
                    Analytics
                  </Label>
                  <Switch
                    id={`analytics-${plan.id}`}
                    checked={plan.enable_analytics}
                    onCheckedChange={(checked) =>
                      toggleFeature(plan.id, "enable_analytics", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Order Email Notifications</h3>
                    <p className="text-sm text-muted-foreground">
                      Send email notifications for new orders
                    </p>
                  </div>
                  <Switch
                    checked={plan.enable_order_emails}
                    onCheckedChange={(checked) =>
                      toggleFeature(plan.id, "enable_order_emails", checked)
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
