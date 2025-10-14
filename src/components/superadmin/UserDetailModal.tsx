import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Copy, Mail, Shield, Trash2, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface UserDetailModalProps {
  user: any;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function UserDetailModal({ user, open, onClose, onRefresh }: UserDetailModalProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    });
  };

  const handleImpersonate = () => {
    toast({
      title: "Impersonate User",
      description: "This feature will be implemented in a future update",
    });
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
                  <p className="text-sm text-muted-foreground">Joined</p>
                  <p className="font-medium">
                    {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
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
                  <Button variant="outline">Change Plan</Button>
                  <Button variant="destructive">Cancel Subscription</Button>
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
    </Dialog>
  );
}
