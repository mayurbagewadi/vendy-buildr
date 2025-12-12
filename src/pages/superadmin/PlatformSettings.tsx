import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowLeft, Save, Trash2, Lock, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface PlatformSettings {
  sender_email: string;
  sender_name: string;
  platform_name: string;
  auto_cleanup_orders: boolean;
  orders_cleanup_months: number;
  auto_cleanup_active_logs: boolean;
  active_logs_cleanup_months: number;
  auto_cleanup_inactive_logs: boolean;
  inactive_logs_cleanup_months: number;
  razorpay_key_id: string;
  razorpay_key_secret: string;
  razorpay_test_mode: boolean;
}

const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

const PlatformSettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [settings, setSettings] = useState<PlatformSettings>({
    sender_email: '',
    sender_name: '',
    platform_name: '',
    auto_cleanup_orders: false,
    orders_cleanup_months: 6,
    auto_cleanup_active_logs: false,
    active_logs_cleanup_months: 6,
    auto_cleanup_inactive_logs: false,
    inactive_logs_cleanup_months: 6,
    razorpay_key_id: '',
    razorpay_key_secret: '',
    razorpay_test_mode: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [subscriptionPlans, setSubscriptionPlans] = useState<any[]>([]);
  const [defaultPlanId, setDefaultPlanId] = useState<string>("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const superAdminSession = sessionStorage.getItem('superadmin_session');
      if (superAdminSession) {
        await Promise.all([loadPlans(), loadSettings()]);
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
      } else {
        await Promise.all([loadPlans(), loadSettings()]);
      }
    };

    const loadPlans = async () => {
      const { data: plans } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (plans) {
        setSubscriptionPlans(plans);
        const defaultPlan = plans.find((p: any) => p.is_default_plan);
        if (defaultPlan) {
          setDefaultPlanId(defaultPlan.id);
        }
      }
    };

    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('platform_settings')
          .select('*')
          .eq('id', SETTINGS_ID)
          .single();

        if (error) throw error;

        if (data) {
          setSettings({
            sender_email: data.sender_email || '',
            sender_name: data.sender_name || '',
            platform_name: data.platform_name || '',
            auto_cleanup_orders: data.auto_cleanup_orders || false,
            orders_cleanup_months: data.orders_cleanup_months || 6,
            auto_cleanup_active_logs: data.auto_cleanup_active_logs || false,
            active_logs_cleanup_months: data.active_logs_cleanup_months || 6,
            auto_cleanup_inactive_logs: data.auto_cleanup_inactive_logs || false,
            inactive_logs_cleanup_months: data.inactive_logs_cleanup_months || 6,
            razorpay_key_id: data.razorpay_key_id || '',
            razorpay_key_secret: data.razorpay_key_secret || '',
            razorpay_test_mode: data.razorpay_test_mode || false,
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        toast({
          title: "Error",
          description: "Failed to load platform settings",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [navigate, toast]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save settings to database
      const { error: settingsError } = await supabase
        .from('platform_settings')
        .update({
          sender_email: settings.sender_email,
          sender_name: settings.sender_name,
          platform_name: settings.platform_name,
          auto_cleanup_orders: settings.auto_cleanup_orders,
          orders_cleanup_months: settings.orders_cleanup_months,
          auto_cleanup_active_logs: settings.auto_cleanup_active_logs,
          active_logs_cleanup_months: settings.active_logs_cleanup_months,
          auto_cleanup_inactive_logs: settings.auto_cleanup_inactive_logs,
          inactive_logs_cleanup_months: settings.inactive_logs_cleanup_months,
          razorpay_key_id: settings.razorpay_key_id,
          razorpay_key_secret: settings.razorpay_key_secret,
          razorpay_test_mode: settings.razorpay_test_mode,
        })
        .eq('id', SETTINGS_ID);

      if (settingsError) throw settingsError;

      // Update default plan in database
      if (defaultPlanId) {
        await supabase
          .from("subscription_plans")
          .update({ is_default_plan: false })
          .neq("id", defaultPlanId);

        await supabase
          .from("subscription_plans")
          .update({ is_default_plan: true })
          .eq("id", defaultPlanId);
      }

      toast({
        title: "Settings saved",
        description: "Platform settings have been updated successfully.",
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: "Failed to save settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualCleanup = async (type: 'orders' | 'activeLogs' | 'inactiveLogs' | 'all') => {
    setIsCleaningUp(true);
    try {
      // All manual cleanup buttons delete ALL data regardless of age
      const body = {
        ordersMonths: 9999,
        activeLogsMonths: 9999,
        inactiveLogsMonths: 9999,
        cleanupOrders: type === 'all' || type === 'orders',
        cleanupActiveLogs: type === 'all' || type === 'activeLogs',
        cleanupInactiveLogs: type === 'all' || type === 'inactiveLogs',
      };

      const { data, error } = await supabase.functions.invoke('cleanup-old-orders', {
        body
      });

      if (error) throw error;

      const messages: string[] = [];
      if (data.results.orders?.deleted) messages.push(`${data.results.orders.deleted} orders`);
      if (data.results.activeLogs?.deleted) messages.push(`${data.results.activeLogs.deleted} active logs`);
      if (data.results.inactiveLogs?.deleted) messages.push(`${data.results.inactiveLogs.deleted} inactive logs`);

      toast({
        title: "Cleanup completed",
        description: `Successfully deleted: ${messages.join(', ')}`,
      });
    } catch (error: any) {
      toast({
        title: "Cleanup failed",
        description: error.message || "Failed to cleanup data.",
        variant: "destructive",
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Validation Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Validation Error",
        description: "New password and confirm password do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      // First verify current password by attempting to sign in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error("User not authenticated");
      }

      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Current password is incorrect");
      }

      // Update password using Supabase's built-in method
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      // Clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

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
                  <h1 className="text-2xl font-bold">Platform Settings</h1>
                  <p className="text-sm text-muted-foreground">
                    Configure platform-wide settings
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Settings</CardTitle>
              <CardDescription>
                Configure the sender information for emails sent to users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="senderEmail">Sender Email</Label>
                <Input
                  id="senderEmail"
                  type="email"
                  placeholder="onboarding@resend.dev"
                  value={settings.sender_email}
                  onChange={(e) =>
                    setSettings({ ...settings, sender_email: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  This email will be used as the sender when sending emails to users
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="senderName">Sender Name</Label>
                <Input
                  id="senderName"
                  type="text"
                  placeholder="Super Admin"
                  value={settings.sender_name}
                  onChange={(e) =>
                    setSettings({ ...settings, sender_name: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  The name that will appear in the "From" field of emails
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure general platform settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platformName">Platform Name</Label>
                <Input
                  id="platformName"
                  type="text"
                  placeholder="Vendy Platform"
                  value={settings.platform_name}
                  onChange={(e) =>
                    setSettings({ ...settings, platform_name: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  The name of your platform
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultPlan">Default Subscription Plan</Label>
                <Select value={defaultPlanId} onValueChange={setDefaultPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select default plan for new stores" />
                  </SelectTrigger>
                  <SelectContent>
                    {subscriptionPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - {plan.monthly_price > 0 ? `₹${plan.monthly_price}/mo` : 'Free'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This plan will be automatically assigned to new store owners
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Account Security - Password Change */}
          <Card>
            <CardHeader>
              <CardTitle>Account Security</CardTitle>
              <CardDescription>
                Change your super admin password
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password (min 8 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters long
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <div className="pt-4">
                <Button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="w-full"
                >
                  <Lock className="mr-2 h-4 w-4" />
                  {isChangingPassword ? "Changing Password..." : "Change Password"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Razorpay Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Razorpay Payment Gateway</CardTitle>
              <CardDescription>
                Configure Razorpay API credentials for subscription payments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="razorpayKeyId">Razorpay API Key ID</Label>
                <Input
                  id="razorpayKeyId"
                  type="text"
                  placeholder="rzp_live_xxxxxxxxxxxxxx or rzp_test_xxxxxxxxxxxxxx"
                  value={settings.razorpay_key_id}
                  onChange={(e) =>
                    setSettings({ ...settings, razorpay_key_id: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Your Razorpay API Key ID (starts with rzp_live_ for production or rzp_test_ for testing)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="razorpayKeySecret">Razorpay API Key Secret</Label>
                <Input
                  id="razorpayKeySecret"
                  type="password"
                  placeholder="Enter your Razorpay Key Secret"
                  value={settings.razorpay_key_secret}
                  onChange={(e) =>
                    setSettings({ ...settings, razorpay_key_secret: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Your Razorpay API Key Secret (keep this secure and never share)
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="razorpayTestMode">Test Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable only if using test credentials (rzp_test_)
                  </p>
                </div>
                <Switch
                  id="razorpayTestMode"
                  checked={settings.razorpay_test_mode}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, razorpay_test_mode: checked })
                  }
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-xs text-foreground">
                  <strong>⚠️ Production Credentials:</strong> Use your LIVE Razorpay credentials (rzp_live_) to accept real payments.
                  These credentials will process actual subscription payments from store owners.
                  Keep them secure and ensure your Razorpay account is properly configured with bank details.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data Cleanup Management */}
          <Card>
            <CardHeader>
              <CardTitle>Data Cleanup Management</CardTitle>
              <CardDescription>
                Configure automatic cleanup settings and manually clean data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Collapsible open={isCleanupOpen} onOpenChange={setIsCleanupOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between mb-4">
                    <span className="flex items-center">
                      <Trash2 className="mr-2 h-4 w-4" />
                      {isCleanupOpen ? "Hide Cleanup Settings" : "Show Cleanup Settings"}
                    </span>
                    {isCleanupOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-6">
              {/* Orders Cleanup Settings */}
              <div className="space-y-4 pb-4 border-b">
                <h3 className="text-sm font-medium">Orders Cleanup</h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoCleanupOrders">Auto Cleanup Orders</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically delete old orders
                    </p>
                  </div>
                  <Switch
                    id="autoCleanupOrders"
                    checked={settings.auto_cleanup_orders}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, auto_cleanup_orders: checked })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ordersCleanupMonths">Cleanup Interval (Months)</Label>
                  <Input
                    id="ordersCleanupMonths"
                    type="number"
                    min="1"
                    max="24"
                    placeholder="6"
                    value={settings.orders_cleanup_months}
                    onChange={(e) =>
                      setSettings({ ...settings, orders_cleanup_months: parseInt(e.target.value) || 6 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-cleanup will delete orders older than this many months (1-24 months)
                  </p>
                </div>
              </div>

              {/* Active Logs Cleanup Settings */}
              <div className="space-y-4 pb-4 border-b">
                <h3 className="text-sm font-medium">Active Logs Cleanup</h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoCleanupActiveLogs">Auto Cleanup Active Logs</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically delete old active store logs
                    </p>
                  </div>
                  <Switch
                    id="autoCleanupActiveLogs"
                    checked={settings.auto_cleanup_active_logs}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, auto_cleanup_active_logs: checked })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activeLogsCleanupMonths">Cleanup Interval (Months)</Label>
                  <Input
                    id="activeLogsCleanupMonths"
                    type="number"
                    min="1"
                    max="24"
                    placeholder="6"
                    value={settings.active_logs_cleanup_months}
                    onChange={(e) =>
                      setSettings({ ...settings, active_logs_cleanup_months: parseInt(e.target.value) || 6 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-cleanup will delete active logs older than this many months (1-24 months)
                  </p>
                </div>
              </div>

              {/* Inactive Logs Cleanup Settings */}
              <div className="space-y-4 pb-4 border-b">
                <h3 className="text-sm font-medium">Inactive Logs Cleanup</h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoCleanupInactiveLogs">Auto Cleanup Inactive Logs</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically delete old inactive store logs
                    </p>
                  </div>
                  <Switch
                    id="autoCleanupInactiveLogs"
                    checked={settings.auto_cleanup_inactive_logs}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, auto_cleanup_inactive_logs: checked })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inactiveLogsCleanupMonths">Cleanup Interval (Months)</Label>
                  <Input
                    id="inactiveLogsCleanupMonths"
                    type="number"
                    min="1"
                    max="24"
                    placeholder="6"
                    value={settings.inactive_logs_cleanup_months}
                    onChange={(e) =>
                      setSettings({ ...settings, inactive_logs_cleanup_months: parseInt(e.target.value) || 6 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-cleanup will delete inactive logs older than this many months (1-24 months)
                  </p>
                </div>
              </div>

              {/* Manual Cleanup Actions */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-medium">Manual Cleanup Actions</h3>
                <p className="text-xs text-muted-foreground">
                  Choose a cleanup action to execute immediately
                </p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full"
                      disabled={isCleaningUp}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {isCleaningUp ? "Cleaning up..." : "Select Cleanup Action"}
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full" align="center">
                    <DropdownMenuItem
                      onClick={() => handleManualCleanup('orders')}
                      disabled={isCleaningUp || !settings.auto_cleanup_orders}
                      className="cursor-pointer"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Cleanup Orders Only
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleManualCleanup('activeLogs')}
                      disabled={isCleaningUp || !settings.auto_cleanup_active_logs}
                      className="cursor-pointer"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Cleanup Active Logs Only
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleManualCleanup('inactiveLogs')}
                      disabled={isCleaningUp || !settings.auto_cleanup_inactive_logs}
                      className="cursor-pointer"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Cleanup Inactive Logs Only
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleManualCleanup('all')}
                      disabled={isCleaningUp || !settings.auto_cleanup_orders || !settings.auto_cleanup_active_logs || !settings.auto_cleanup_inactive_logs}
                      className="cursor-pointer text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Cleanup All Data
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <p className="text-xs text-muted-foreground">
                  Enable the corresponding auto-cleanup toggle above to activate each cleanup action
                </p>
              </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PlatformSettingsPage;
