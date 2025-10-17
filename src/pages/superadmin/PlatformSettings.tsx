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

  const handleManualCleanup = async () => {
    setIsCleaningUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-old-orders', {
        body: { months: settings.cleanupIntervalMonths }
      });

      if (error) throw error;

      toast({
        title: "Cleanup completed",
        description: `Successfully deleted ${data.deletedCount} old orders.`,
      });
    } catch (error: any) {
      toast({
        title: "Cleanup failed",
        description: error.message || "Failed to cleanup old orders.",
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

          <Card>
            <CardHeader>
              <CardTitle>Data Cleanup Settings</CardTitle>
              <CardDescription>
                Configure automatic cleanup of old logs and orders for cost optimization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoCleanup">Auto Cleanup</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically delete old orders and logs
                  </p>
                </div>
                <Switch
                  id="autoCleanup"
                  checked={settings.autoCleanupEnabled}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, autoCleanupEnabled: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cleanupInterval">Cleanup Interval (Months)</Label>
                <Input
                  id="cleanupInterval"
                  type="number"
                  min="1"
                  max="24"
                  placeholder="6"
                  value={settings.cleanupIntervalMonths}
                  onChange={(e) =>
                    setSettings({ ...settings, cleanupIntervalMonths: parseInt(e.target.value) || 6 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Orders older than this many months will be deleted (1-24 months)
                </p>
              </div>

              <div className="pt-4 border-t">
                <Button 
                  onClick={handleManualCleanup} 
                  disabled={isCleaningUp}
                  variant="destructive"
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isCleaningUp ? "Cleaning up..." : "Run Manual Cleanup Now"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  This will immediately delete all orders older than {settings.cleanupIntervalMonths} months
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PlatformSettingsPage;
