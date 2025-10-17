import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getPlatformSettings, savePlatformSettings, PlatformSettings } from "@/lib/platformSettings";
import { supabase } from "@/integrations/supabase/client";

const PlatformSettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [settings, setSettings] = useState<PlatformSettings>(getPlatformSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  useEffect(() => {
    // Check if super admin is logged in
    const superAdminSession = sessionStorage.getItem('superadmin_session');
    if (!superAdminSession) {
      navigate('/superadmin/login');
    }
  }, [navigate]);

  const handleSave = () => {
    setIsSaving(true);
    try {
      savePlatformSettings(settings);
      toast({
        title: "Settings saved",
        description: "Platform settings have been updated successfully.",
      });
    } catch (error) {
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
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
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
                  value={settings.senderEmail}
                  onChange={(e) =>
                    setSettings({ ...settings, senderEmail: e.target.value })
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
                  value={settings.senderName}
                  onChange={(e) =>
                    setSettings({ ...settings, senderName: e.target.value })
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
                  value={settings.platformName}
                  onChange={(e) =>
                    setSettings({ ...settings, platformName: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  The name of your platform
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Orders Cleanup */}
          <Card>
            <CardHeader>
              <CardTitle>Orders Cleanup</CardTitle>
              <CardDescription>
                Configure automatic cleanup of old orders for cost optimization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoCleanupOrders">Auto Cleanup Orders</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically delete old orders
                  </p>
                </div>
                <Switch
                  id="autoCleanupOrders"
                  checked={settings.autoCleanupOrders}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, autoCleanupOrders: checked })
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
                  value={settings.ordersCleanupMonths}
                  onChange={(e) =>
                    setSettings({ ...settings, ordersCleanupMonths: parseInt(e.target.value) || 6 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Auto-cleanup will delete orders older than this many months (1-24 months)
                </p>
              </div>

              <div className="pt-4 border-t">
                <Button 
                  onClick={() => handleManualCleanup('orders')} 
                  disabled={isCleaningUp || !settings.autoCleanupOrders}
                  variant="destructive"
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isCleaningUp ? "Cleaning up..." : "Cleanup Orders Now"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  {settings.autoCleanupOrders 
                    ? "Delete ALL orders from the database" 
                    : "Enable auto-cleanup toggle above to use manual cleanup"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Active Logs Cleanup */}
          <Card>
            <CardHeader>
              <CardTitle>Active Logs Cleanup</CardTitle>
              <CardDescription>
                Configure automatic cleanup of active store activity logs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoCleanupActiveLogs">Auto Cleanup Active Logs</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically delete old active store logs
                  </p>
                </div>
                <Switch
                  id="autoCleanupActiveLogs"
                  checked={settings.autoCleanupActiveLogs}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, autoCleanupActiveLogs: checked })
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
                  value={settings.activeLogsCleanupMonths}
                  onChange={(e) =>
                    setSettings({ ...settings, activeLogsCleanupMonths: parseInt(e.target.value) || 6 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Auto-cleanup will delete active logs older than this many months (1-24 months)
                </p>
              </div>

              <div className="pt-4 border-t">
                <Button 
                  onClick={() => handleManualCleanup('activeLogs')} 
                  disabled={isCleaningUp || !settings.autoCleanupActiveLogs}
                  variant="destructive"
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isCleaningUp ? "Cleaning up..." : "Cleanup Active Logs Now"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  {settings.autoCleanupActiveLogs 
                    ? "Delete ALL active logs from the database" 
                    : "Enable auto-cleanup toggle above to use manual cleanup"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Inactive Logs Cleanup */}
          <Card>
            <CardHeader>
              <CardTitle>Inactive Logs Cleanup</CardTitle>
              <CardDescription>
                Configure automatic cleanup of inactive store activity logs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoCleanupInactiveLogs">Auto Cleanup Inactive Logs</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically delete old inactive store logs
                  </p>
                </div>
                <Switch
                  id="autoCleanupInactiveLogs"
                  checked={settings.autoCleanupInactiveLogs}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, autoCleanupInactiveLogs: checked })
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
                  value={settings.inactiveLogsCleanupMonths}
                  onChange={(e) =>
                    setSettings({ ...settings, inactiveLogsCleanupMonths: parseInt(e.target.value) || 6 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Auto-cleanup will delete inactive logs older than this many months (1-24 months)
                </p>
              </div>

              <div className="pt-4 border-t">
                <Button 
                  onClick={() => handleManualCleanup('inactiveLogs')} 
                  disabled={isCleaningUp || !settings.autoCleanupInactiveLogs}
                  variant="destructive"
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isCleaningUp ? "Cleaning up..." : "Cleanup Inactive Logs Now"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  {settings.autoCleanupInactiveLogs 
                    ? "Delete ALL inactive logs from the database" 
                    : "Enable auto-cleanup toggle above to use manual cleanup"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cleanup All */}
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Cleanup All Data</CardTitle>
              <CardDescription>
                Run a comprehensive cleanup of all old data at once
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => handleManualCleanup('all')} 
                disabled={isCleaningUp || !settings.autoCleanupOrders || !settings.autoCleanupActiveLogs || !settings.autoCleanupInactiveLogs}
                variant="destructive"
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isCleaningUp ? "Cleaning up..." : "Cleanup All Data Now"}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                {(settings.autoCleanupOrders && settings.autoCleanupActiveLogs && settings.autoCleanupInactiveLogs)
                  ? "This will delete ALL orders, active logs, and inactive logs regardless of age"
                  : "Enable all three auto-cleanup toggles above to use this feature"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PlatformSettingsPage;
