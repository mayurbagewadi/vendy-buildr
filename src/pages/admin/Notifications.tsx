import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, MonitorSmartphone, Send, ShieldAlert, Smartphone, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  BrowserPushStatus,
  disableBrowserPush,
  enableBrowserPush,
  getBrowserPushStatus,
  sendTestBrowserPush,
} from "@/lib/browserPushNotifications";

const statusCopy: Record<BrowserPushStatus, { label: string; tone: string; icon: typeof Bell }> = {
  enabled: { label: "Enabled on this device", tone: "bg-green-500/10 text-green-700 border-green-500/20", icon: Bell },
  not_enabled: { label: "Not enabled", tone: "bg-muted text-muted-foreground border-border", icon: BellOff },
  blocked: { label: "Blocked by browser", tone: "bg-destructive/10 text-destructive border-destructive/20", icon: ShieldAlert },
  unsupported: { label: "Unsupported browser", tone: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
};

const Notifications = () => {
  const { toast } = useToast();
  const [status, setStatus] = useState<BrowserPushStatus>("not_enabled");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    browser_push_enabled: true,
    new_order_enabled: true,
    paid_order_enabled: true,
    low_stock_enabled: false,
    low_stock_threshold: 5,
  });
  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const pushStatus = await getBrowserPushStatus();
      setStatus(pushStatus);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!store) return;

      const [{ data: pref }, { data: devices }] = await Promise.all([
        (supabase as any)
          .from("notification_preferences")
          .select("browser_push_enabled, new_order_enabled, paid_order_enabled, low_stock_enabled, low_stock_threshold")
          .eq("store_id", store.id)
          .eq("user_id", session.user.id)
          .maybeSingle(),
        (supabase as any)
          .from("browser_push_subscriptions")
          .select("id, user_agent, device_label, last_seen_at, disabled_at, created_at")
          .eq("store_id", store.id)
          .order("last_seen_at", { ascending: false })
          .limit(10),
      ]);

      if (pref) setPreferences((current) => ({ ...current, ...pref }));
      setSubscriptions(devices || []);
    } catch (error) {
      console.error("[Notifications] load failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const upsertPreferences = async (next: typeof preferences) => {
    setPreferences(next);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!store) return;

    const { error } = await (supabase as any)
      .from("notification_preferences")
      .upsert({
        store_id: store.id,
        user_id: session.user.id,
        ...next,
      }, { onConflict: "store_id,user_id" });

    if (error) {
      toast({ title: "Could not save preferences", description: error.message, variant: "destructive" });
    }
  };

  const handleThresholdChange = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    const nextThreshold = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 999999)) : 0;
    upsertPreferences({ ...preferences, low_stock_threshold: nextThreshold });
  };

  const handleEnable = async () => {
    setSaving(true);
    try {
      await enableBrowserPush();
      toast({ title: "Browser notifications enabled", description: "This device will receive new order alerts." });
      await load();
    } catch (error: any) {
      toast({ title: "Could not enable notifications", description: error.message, variant: "destructive" });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    setSaving(true);
    try {
      await disableBrowserPush();
      toast({ title: "Notifications disabled on this device" });
      await load();
    } catch (error: any) {
      toast({ title: "Could not disable notifications", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setSaving(true);
    try {
      await sendTestBrowserPush();
      toast({ title: "Test notification sent", description: "Check your browser notification area." });
    } catch (error: any) {
      toast({ title: "Test failed", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const StatusIcon = statusCopy[status].icon;

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-sm text-muted-foreground">Control browser alerts for new store activity on each device.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MonitorSmartphone className="h-5 w-5" />
                  Browser Push
                </CardTitle>
                <CardDescription>Enable new order notifications on this browser and device.</CardDescription>
              </div>
              <Badge variant="outline" className={statusCopy[status].tone}>
                <StatusIcon className="mr-1 h-3.5 w-3.5" />
                {statusCopy[status].label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {status === "blocked" && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Browser permission is blocked</AlertTitle>
                <AlertDescription>
                  Open site settings in your browser and allow notifications for this domain, then return here.
                </AlertDescription>
              </Alert>
            )}

            {status === "unsupported" && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>This browser does not support push notifications</AlertTitle>
                <AlertDescription>Use a modern Chrome, Edge, Firefox, or Android browser for browser push alerts.</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              {status === "enabled" ? (
                <>
                  <Button onClick={handleTest} disabled={saving}>
                    <Send className="mr-2 h-4 w-4" />
                    Send Test
                  </Button>
                  <Button variant="outline" onClick={handleDisable} disabled={saving}>
                    <BellOff className="mr-2 h-4 w-4" />
                    Disable This Device
                  </Button>
                </>
              ) : (
                <Button onClick={handleEnable} disabled={saving || status === "unsupported"}>
                  <Bell className="mr-2 h-4 w-4" />
                  Enable Browser Notifications
                </Button>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Notification Types</h3>
              {[
                ["new_order_enabled", "COD orders", "Notify when a new cash-on-delivery order is placed."],
                ["paid_order_enabled", "Paid orders", "Notify only after online payment is verified."],
                ["low_stock_enabled", "Low stock", `Notify when product stock reaches ${preferences.low_stock_threshold} or less.`],
              ].map(([key, label, description]) => (
                <div key={key} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <Switch
                    checked={(preferences as any)[key]}
                    onCheckedChange={(checked) => upsertPreferences({ ...preferences, [key]: checked })}
                  />
                </div>
              ))}
              <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Low-stock threshold</p>
                  <p className="text-xs text-muted-foreground">Products at or below this stock count create one alert until restocked.</p>
                </div>
                <Input
                  type="number"
                  min="0"
                  max="999999"
                  step="1"
                  value={preferences.low_stock_threshold}
                  onChange={(event) => handleThresholdChange(event.target.value)}
                  className="w-full sm:w-28"
                  disabled={saving}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Registered Devices
            </CardTitle>
            <CardDescription>Recent browsers connected to this store owner account.</CardDescription>
          </CardHeader>
          <CardContent>
            {subscriptions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <BellOff className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No devices registered yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {subscriptions.map((device) => (
                  <div key={device.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{device.device_label || "Browser device"}</p>
                      {device.disabled_at ? (
                        <Badge variant="outline">Disabled</Badge>
                      ) : (
                        <Badge className="bg-green-600">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{device.user_agent || "Unknown browser"}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Last seen {new Date(device.last_seen_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Notifications;
