import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Copy, Mail, Shield, Trash2, RefreshCw, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { RenewSubscriptionModal } from "./RenewSubscriptionModal";
import { AssignPlanModal } from "./AssignPlanModal";
import { supabase } from "@/integrations/supabase/client";

interface UserDetailModalProps {
  user: any;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function UserDetailModal({ user, open, onClose, onRefresh }: UserDetailModalProps) {
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [changePlanModalOpen, setChangePlanModalOpen] = useState(false);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  // Calculate countdown timer
  useEffect(() => {
    if (!user?.subscription) return;

    const calculateTimeRemaining = () => {
      const targetDate = user.subscription.status === 'trial'
        ? user.subscription.trial_ends_at
        : user.subscription.current_period_end;

      if (!targetDate) return "";

      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const difference = target - now;

      if (difference <= 0) {
        return "Expired";
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    };

    // Update immediately
    setTimeRemaining(calculateTimeRemaining());

    // Update every second
    const timer = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);

    return () => clearInterval(timer);
  }, [user?.subscription]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    });
  };

  const handleImpersonate = async () => {
    try {
      console.log('Attempting to login as user:', user.id, user.email);

      const { data, error } = await supabase.functions.invoke('login-as-user', {
        body: { user_id: user.id }
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        // Try to get the response body for more details
        if (error.context?.body) {
          const responseText = await error.context.text();
          console.error('Response body:', responseText);
          try {
            const responseJson = JSON.parse(responseText);
            if (responseJson.error) {
              throw new Error(responseJson.error);
            }
          } catch (parseError) {
            console.error('Could not parse response:', parseError);
          }
        }
        throw error;
      }

      if (data?.error) {
        console.error('Error from edge function:', data.error);
        throw new Error(data.error);
      }

      if (data?.access_token) {
        // Store current super admin session to restore later
        const { data: currentSession } = await supabase.auth.getSession();
        if (currentSession.session) {
          localStorage.setItem('superadmin_session', JSON.stringify(currentSession.session));
        }

        // Set user session
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token
        });

        toast({
          title: "Success",
          description: `Logged in as ${user.email}`,
        });

        // Redirect to admin dashboard (SAME WINDOW)
        window.location.href = '/admin/dashboard';
      } else {
        throw new Error('No access token received from edge function');
      }
    } catch (error: any) {
      console.error('Login as user error:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to login as user',
        variant: "destructive",
      });
    }
  };

  const handleCancelSubscription = async () => {
    if (!user.subscription) {
      toast({
        title: "Error",
        description: "No active subscription to cancel",
        variant: "destructive",
      });
      return;
    }

    // Show confirmation dialog
    const confirmCancel = confirm(
      `Are you sure you want to cancel the subscription for ${user.email}?\n\n` +
      `Plan: ${user.subscription.plan.name}\n` +
      `Status: ${user.subscription.status}\n\n` +
      `This action will cancel their subscription immediately.`
    );

    if (!confirmCancel) return;

    try {
      setCancellingSubscription(true);

      // Update subscription status to cancelled
      const { error } = await supabase
        .from("subscriptions")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString()
        })
        .eq("id", user.subscription.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Subscription cancelled for ${user.email}`,
      });

      // Refresh the user list
      onRefresh();

      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 1000);

    } catch (error: any) {
      console.error('Cancel subscription error:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to cancel subscription',
        variant: "destructive",
      });
    } finally {
      setCancellingSubscription(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Details - {user.email}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="store">Store Details</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Account Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Account Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">User ID</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm">{user.id.slice(0, 8)}...</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(user.id)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="font-medium">{user.full_name || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone Number</p>
                  <p className="font-medium">{user.phone || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Joined</p>
                  <p className="font-medium">
                    {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
                {user.store?.whatsapp_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">WhatsApp Number</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{user.store.whatsapp_number}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(user.store.whatsapp_number)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Store Information */}
            {user.store && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Store Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Store Name</p>
                    <p className="font-medium">{user.store.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Store Slug</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{user.store.slug}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/${user.store.slug}`, "_blank")}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleImpersonate}>
                  <Shield className="w-4 h-4 mr-2" />
                  Login as User
                </Button>
                <Button variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset Password
                </Button>
                <Button variant="outline">
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email
                </Button>
                <Button variant="destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="subscription" className="space-y-6">
            {user.subscription ? (
              <>
                {/* Countdown Timer Banner */}
                {timeRemaining && timeRemaining !== "Expired" && (
                  <div className={`relative overflow-hidden rounded-lg border ${
                    user.subscription.status === 'trial'
                      ? 'bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30'
                      : 'bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30'
                  } backdrop-blur-sm`}>
                    <div className="p-4 flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${
                        user.subscription.status === 'trial'
                          ? 'bg-blue-500/20'
                          : 'bg-green-500/20'
                      }`}>
                        <Clock className={`w-6 h-6 ${
                          user.subscription.status === 'trial'
                            ? 'text-blue-400'
                            : 'text-green-400'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {user.subscription.status === 'trial' ? 'Trial Period' : 'Active Subscription'}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              user.subscription.status === 'trial'
                                ? 'border-blue-500/50 text-blue-400'
                                : 'border-green-500/50 text-green-400'
                            }`}
                          >
                            {user.subscription.status === 'trial' ? 'Trial' : 'Paid'}
                          </Badge>
                        </div>
                        <p className="text-xl font-semibold mb-1">
                          {user.subscription.status === 'trial'
                            ? `Ends in ${timeRemaining}`
                            : `Renews in ${timeRemaining}`
                          }
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {user.subscription.status === 'trial'
                            ? 'Trial will expire on ' + new Date(user.subscription.trial_ends_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                            : 'Next billing on ' + new Date(user.subscription.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Current Subscription</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Plan</p>
                      <Badge variant="outline">{user.subscription.plan.name}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge
                        className={
                          user.subscription.status === "active"
                            ? "bg-green-500"
                            : user.subscription.status === "trial"
                            ? "bg-orange-500"
                            : "bg-gray-500"
                        }
                      >
                        {user.subscription.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Billing Cycle</p>
                      <p className="font-medium capitalize">
                        {user.subscription.billing_cycle}
                      </p>
                    </div>
                    {user.subscription.started_at && (
                      <div>
                        <p className="text-sm text-muted-foreground">Started On</p>
                        <p className="font-medium">
                          {new Date(user.subscription.started_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {user.subscription.current_period_start && (
                      <div>
                        <p className="text-sm text-muted-foreground">Current Period Start</p>
                        <p className="font-medium">
                          {new Date(user.subscription.current_period_start).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {user.subscription.current_period_end && (
                      <div>
                        <p className="text-sm text-muted-foreground">Current Period End</p>
                        <p className="font-medium">
                          {new Date(user.subscription.current_period_end).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {user.subscription.trial_ends_at && (
                      <div>
                        <p className="text-sm text-muted-foreground">Trial Ends</p>
                        <p className="font-medium">
                          {new Date(user.subscription.trial_ends_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setRenewModalOpen(true)}
                    variant="default"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Renew Subscription
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setChangePlanModalOpen(true)}
                  >
                    Change Plan
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleCancelSubscription}
                    disabled={cancellingSubscription}
                  >
                    {cancellingSubscription ? "Cancelling..." : "Cancel Subscription"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No active subscription</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="store" className="space-y-6">
            {user.store ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Store Name</p>
                    <p className="font-medium">{user.store.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Slug</p>
                    <p className="font-medium">{user.store.slug}</p>
                  </div>
                </div>
                <Button>Edit Store Settings</Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No store created</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <div className="text-center py-8">
              <p className="text-muted-foreground">Activity log will be shown here</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Renew Subscription Modal */}
      {user.subscription && (
        <RenewSubscriptionModal
          subscription={user.subscription}
          open={renewModalOpen}
          onClose={() => setRenewModalOpen(false)}
          onSuccess={onRefresh}
        />
      )}

      {/* Change Plan Modal */}
      <AssignPlanModal
        open={changePlanModalOpen}
        onOpenChange={setChangePlanModalOpen}
        userId={user.id}
        userEmail={user.email}
        currentSubscription={user.subscription}
        onSuccess={onRefresh}
      />
    </Dialog>
  );
}
