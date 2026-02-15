import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Coins,
  Plus,
  Pencil,
  Trash2,
  Save,
  Loader2,
  TrendingUp,
  Users,
  Zap,
  DollarSign,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TokenPackage {
  id: string;
  name: string;
  description: string | null;
  tokens_included: number;
  price: number;
  is_active: boolean;
  display_order: number;
}

interface TokenSettings {
  token_expiry_enabled: boolean;
  token_expiry_duration: number;
  token_expiry_unit: string;
}

interface Analytics {
  total_revenue: number;
  total_tokens_sold: number;
  total_tokens_used: number;
  active_stores: number;
}

const TOKEN_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

const AITokenPricing = () => {
  const { toast } = useToast();
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [settings, setSettings] = useState<TokenSettings>({
    token_expiry_enabled: true,
    token_expiry_duration: 12,
    token_expiry_unit: "months",
  });
  const [analytics, setAnalytics] = useState<Analytics>({
    total_revenue: 0,
    total_tokens_sold: 0,
    total_tokens_used: 0,
    active_stores: 0,
  });
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<TokenPackage | null>(null);
  const [savingPackage, setSavingPackage] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [packageForm, setPackageForm] = useState({
    name: "",
    description: "",
    tokens_included: "",
    price: "",
    display_order: "0",
    is_active: true,
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [pkgsResult, settingsResult, analyticsResult] = await Promise.all([
        supabase.from("ai_token_packages").select("*").order("display_order"),
        supabase.from("ai_token_settings").select("*").eq("id", TOKEN_SETTINGS_ID).single(),
        supabase.from("ai_token_purchases").select("tokens_purchased, tokens_used, amount_paid, store_id, status"),
      ]);

      if (pkgsResult.data) setPackages(pkgsResult.data);
      if (settingsResult.data) {
        setSettings({
          token_expiry_enabled: settingsResult.data.token_expiry_enabled ?? true,
          token_expiry_duration: settingsResult.data.token_expiry_duration ?? 12,
          token_expiry_unit: settingsResult.data.token_expiry_unit ?? "months",
        });
      }

      if (analyticsResult.data) {
        const purchases = analyticsResult.data;
        const totalRevenue = purchases.reduce((s: number, p: any) => s + Number(p.amount_paid || 0), 0);
        const totalSold = purchases.reduce((s: number, p: any) => s + Number(p.tokens_purchased || 0), 0);
        const totalUsed = purchases.reduce((s: number, p: any) => s + Number(p.tokens_used || 0), 0);
        const activeStores = new Set(
          purchases.filter((p: any) => p.status === "active").map((p: any) => p.store_id)
        ).size;
        setAnalytics({ total_revenue: totalRevenue, total_tokens_sold: totalSold, total_tokens_used: totalUsed, active_stores: activeStores });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from("ai_token_settings")
        .upsert({
          id: TOKEN_SETTINGS_ID,
          token_expiry_enabled: settings.token_expiry_enabled,
          token_expiry_duration: settings.token_expiry_duration,
          token_expiry_unit: settings.token_expiry_unit,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });

      if (error) throw error;
      toast({ title: "Saved", description: "Token expiry settings saved" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const openAddPackage = () => {
    setEditingPackage(null);
    setPackageForm({ name: "", description: "", tokens_included: "", price: "", display_order: String(packages.length + 1), is_active: true });
    setPackageDialogOpen(true);
  };

  const openEditPackage = (pkg: TokenPackage) => {
    setEditingPackage(pkg);
    setPackageForm({
      name: pkg.name,
      description: pkg.description || "",
      tokens_included: String(pkg.tokens_included),
      price: String(pkg.price),
      display_order: String(pkg.display_order),
      is_active: pkg.is_active,
    });
    setPackageDialogOpen(true);
  };

  const handleSavePackage = async () => {
    if (!packageForm.name || !packageForm.tokens_included || !packageForm.price) {
      toast({ title: "Error", description: "Name, tokens, and price are required", variant: "destructive" });
      return;
    }
    setSavingPackage(true);
    try {
      const payload = {
        name: packageForm.name,
        description: packageForm.description || null,
        tokens_included: parseInt(packageForm.tokens_included),
        price: parseFloat(packageForm.price),
        display_order: parseInt(packageForm.display_order) || 0,
        is_active: packageForm.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingPackage) {
        const { error } = await supabase.from("ai_token_packages").update(payload).eq("id", editingPackage.id);
        if (error) throw error;
        toast({ title: "Updated", description: "Package updated successfully" });
      } else {
        const { error } = await supabase.from("ai_token_packages").insert(payload);
        if (error) throw error;
        toast({ title: "Created", description: "Package created successfully" });
      }

      setPackageDialogOpen(false);
      await loadAll();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingPackage(false);
    }
  };

  const handleDeletePackage = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from("ai_token_packages").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Package deleted" });
      setPackages(prev => prev.filter(p => p.id !== id));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Coins className="w-6 h-6 text-primary" />
          AI Token Pricing
        </h1>
        <p className="text-muted-foreground">Manage token packages, expiry settings, and view analytics</p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: formatPrice(analytics.total_revenue), icon: DollarSign, color: "text-green-600" },
          { label: "Tokens Sold", value: analytics.total_tokens_sold.toLocaleString("en-IN"), icon: Coins, color: "text-primary" },
          { label: "Tokens Used", value: analytics.total_tokens_used.toLocaleString("en-IN"), icon: Zap, color: "text-orange-500" },
          { label: "Active Stores", value: analytics.active_stores, icon: Users, color: "text-purple-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-bold text-foreground">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Token Packages */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Token Packages</CardTitle>
              <CardDescription>Configure packages available for store owners to purchase</CardDescription>
            </div>
            <Button onClick={openAddPackage} size="sm">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Package
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {packages.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No packages yet. Add one above.</p>
          ) : (
            <div className="space-y-3">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${pkg.is_active ? "border-border" : "border-border bg-muted/30 opacity-60"}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Coins className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{pkg.name}</span>
                        {!pkg.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {pkg.tokens_included.toLocaleString("en-IN")} tokens · {formatPrice(pkg.price)}
                        <span className="ml-2 text-xs">
                          (₹{(pkg.price / pkg.tokens_included).toFixed(2)}/token)
                        </span>
                      </p>
                      {pkg.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{pkg.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => openEditPackage(pkg)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeletePackage(pkg.id)}
                      disabled={deletingId === pkg.id}
                    >
                      {deletingId === pkg.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token Expiry Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Token Expiry Settings</CardTitle>
          <CardDescription>Control when purchased tokens expire for store owners</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Enable Token Expiry</Label>
              <p className="text-sm text-muted-foreground">When disabled, tokens never expire</p>
            </div>
            <Switch
              checked={settings.token_expiry_enabled}
              onCheckedChange={(v) => setSettings(prev => ({ ...prev, token_expiry_enabled: v }))}
            />
          </div>

          {settings.token_expiry_enabled && (
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label className="text-sm mb-1.5 block">Duration</Label>
                <Input
                  type="number"
                  min="1"
                  value={settings.token_expiry_duration}
                  onChange={(e) => setSettings(prev => ({ ...prev, token_expiry_duration: parseInt(e.target.value) || 1 }))}
                  className="max-w-[120px]"
                />
              </div>
              <div className="flex-1">
                <Label className="text-sm mb-1.5 block">Unit</Label>
                <Select
                  value={settings.token_expiry_unit}
                  onValueChange={(v) => setSettings(prev => ({ ...prev, token_expiry_unit: v }))}
                >
                  <SelectTrigger className="max-w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="months">Months</SelectItem>
                    <SelectItem value="years">Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Button onClick={handleSaveSettings} disabled={savingSettings}>
            {savingSettings ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* Package Dialog */}
      <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPackage ? "Edit Package" : "Add Token Package"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm mb-1.5 block">Package Name *</Label>
              <Input
                placeholder="e.g. Basic, Pro, Enterprise"
                value={packageForm.name}
                onChange={(e) => setPackageForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Description</Label>
              <Input
                placeholder="e.g. 100 AI design generations"
                value={packageForm.description}
                onChange={(e) => setPackageForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm mb-1.5 block">Tokens Included *</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="100"
                  value={packageForm.tokens_included}
                  onChange={(e) => setPackageForm(prev => ({ ...prev, tokens_included: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Price (₹) *</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="199"
                  value={packageForm.price}
                  onChange={(e) => setPackageForm(prev => ({ ...prev, price: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm mb-1.5 block">Display Order</Label>
                <Input
                  type="number"
                  min="0"
                  value={packageForm.display_order}
                  onChange={(e) => setPackageForm(prev => ({ ...prev, display_order: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-3 mt-6">
                <Switch
                  checked={packageForm.is_active}
                  onCheckedChange={(v) => setPackageForm(prev => ({ ...prev, is_active: v }))}
                />
                <Label className="text-sm">Active</Label>
              </div>
            </div>
            {packageForm.tokens_included && packageForm.price && (
              <p className="text-sm text-muted-foreground">
                Price per token: ₹{(parseFloat(packageForm.price) / parseInt(packageForm.tokens_included)).toFixed(2)}
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSavePackage} disabled={savingPackage} className="flex-1">
                {savingPackage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {editingPackage ? "Update Package" : "Create Package"}
              </Button>
              <Button variant="outline" onClick={() => setPackageDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AITokenPricing;
