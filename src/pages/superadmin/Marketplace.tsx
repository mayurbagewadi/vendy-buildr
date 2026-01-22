import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Edit, Trash2, Package, Truck, BarChart3, MessageSquare, Mail, Target, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MarketplaceFeature {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  is_free: boolean;
  price: number;
  is_active: boolean;
  menu_order: number;
  created_at: string;
  pricing_model?: string;
  price_onetime?: number;
  price_monthly?: number;
  price_yearly?: number;
  quota_onetime?: number;
  quota_monthly?: number;
  quota_yearly?: number;
  quota_period?: string;
}

const iconOptions = [
  { value: "Truck", label: "Truck (Shipping)", icon: Truck },
  { value: "BarChart3", label: "Chart (Analytics)", icon: BarChart3 },
  { value: "MessageSquare", label: "Chat (Live Chat)", icon: MessageSquare },
  { value: "Mail", label: "Mail (Email)", icon: Mail },
  { value: "Target", label: "Target (Ads)", icon: Target },
  { value: "Package", label: "Package (Default)", icon: Package },
];

const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, any> = {
    Truck,
    BarChart3,
    MessageSquare,
    Mail,
    Target,
    Package,
  };
  return iconMap[iconName] || Package;
};

const SuperadminMarketplace = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [features, setFeatures] = useState<MarketplaceFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [selectedFeature, setSelectedFeature] = useState<MarketplaceFeature | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [featureToDelete, setFeatureToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "Package",
    is_free: true,
    price: 0,
    is_active: true,
    menu_order: 0,
    pricing_model: "onetime",
    price_onetime: 0,
    price_monthly: 0,
    price_yearly: 0,
    quota_onetime: 15,
    quota_monthly: 30,
    quota_yearly: 50,
    quota_period: "monthly",
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const superAdminSession = sessionStorage.getItem('superadmin_session');
        if (!superAdminSession) {
          navigate('/superadmin/login');
          return;
        }
      }

      if (user) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'super_admin');

        if (!roles || roles.length === 0) {
          navigate('/superadmin/login');
          return;
        }
      }

      fetchFeatures();
    };

    checkAuth();
  }, [navigate]);

  const fetchFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from('marketplace_features')
        .select('*')
        .order('menu_order');

      if (error) throw error;
      setFeatures(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load marketplace features",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddFeature = () => {
    setDialogMode("add");
    setSelectedFeature(null);
    setFormData({
      name: "",
      slug: "",
      description: "",
      icon: "Package",
      is_free: true,
      price: 0,
      is_active: true,
      menu_order: features.length + 1,
      pricing_model: "onetime",
      price_onetime: 0,
      price_monthly: 0,
      price_yearly: 0,
      quota_onetime: 15,
      quota_monthly: 30,
      quota_yearly: 50,
      quota_period: "monthly",
    });
    setDialogOpen(true);
  };

  const handleEditFeature = (feature: MarketplaceFeature) => {
    setDialogMode("edit");
    setSelectedFeature(feature);
    setFormData({
      name: feature.name,
      slug: feature.slug,
      description: feature.description || "",
      icon: feature.icon,
      is_free: feature.is_free,
      price: feature.price,
      is_active: feature.is_active,
      menu_order: feature.menu_order,
      pricing_model: feature.pricing_model || "onetime",
      price_onetime: feature.price_onetime || 0,
      price_monthly: feature.price_monthly || 0,
      price_yearly: feature.price_yearly || 0,
      quota_onetime: feature.quota_onetime || 15,
      quota_monthly: feature.quota_monthly || 30,
      quota_yearly: feature.quota_yearly || 50,
      quota_period: feature.quota_period || "monthly",
    });
    setDialogOpen(true);
  };

  const handleSaveFeature = async () => {
    if (!formData.name || !formData.slug) {
      toast({
        title: "Error",
        description: "Name and slug are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (dialogMode === "add") {
        const { error } = await supabase
          .from('marketplace_features')
          .insert({
            name: formData.name,
            slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
            description: formData.description,
            icon: formData.icon,
            is_free: formData.is_free,
            price: formData.is_free ? 0 : formData.price,
            is_active: formData.is_active,
            menu_order: formData.menu_order,
            pricing_model: formData.pricing_model,
            price_onetime: formData.price_onetime,
            price_monthly: formData.price_monthly,
            price_yearly: formData.price_yearly,
            quota_onetime: formData.quota_onetime,
            quota_monthly: formData.quota_monthly,
            quota_yearly: formData.quota_yearly,
            quota_period: formData.quota_period,
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Feature added to marketplace",
        });
      } else {
        const { error } = await supabase
          .from('marketplace_features')
          .update({
            name: formData.name,
            slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
            description: formData.description,
            icon: formData.icon,
            is_free: formData.is_free,
            price: formData.is_free ? 0 : formData.price,
            is_active: formData.is_active,
            menu_order: formData.menu_order,
            pricing_model: formData.pricing_model,
            price_onetime: formData.price_onetime,
            price_monthly: formData.price_monthly,
            price_yearly: formData.price_yearly,
            quota_onetime: formData.quota_onetime,
            quota_monthly: formData.quota_monthly,
            quota_yearly: formData.quota_yearly,
            quota_period: formData.quota_period,
          })
          .eq('id', selectedFeature?.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Feature updated successfully",
        });
      }

      setDialogOpen(false);
      fetchFeatures();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save feature",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFeature = async () => {
    if (!featureToDelete) return;

    try {
      const { error } = await supabase
        .from('marketplace_features')
        .delete()
        .eq('id', featureToDelete);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Feature deleted from marketplace",
      });

      setDeleteDialogOpen(false);
      setFeatureToDelete(null);
      fetchFeatures();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete feature",
        variant: "destructive",
      });
    }
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/superadmin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Marketplace Features</h1>
              <p className="text-sm text-muted-foreground">Manage features available to store owners</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={handleAddFeature}>
              <Plus className="h-4 w-4 mr-2" />
              Add Feature
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : features.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No features yet</h3>
              <p className="text-muted-foreground mb-4">Add your first marketplace feature</p>
              <Button onClick={handleAddFeature}>
                <Plus className="h-4 w-4 mr-2" />
                Add Feature
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => {
              const IconComponent = getIconComponent(feature.icon);
              return (
                <Card key={feature.id} className={!feature.is_active ? "opacity-60" : ""}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <IconComponent className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{feature.name}</CardTitle>
                          <code className="text-xs text-muted-foreground">{feature.slug}</code>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditFeature(feature)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => {
                            setFeatureToDelete(feature.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">{feature.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        {feature.is_free ? (
                          <Badge variant="secondary">Free</Badge>
                        ) : (
                          <Badge variant="default">₹{feature.price}</Badge>
                        )}
                        {feature.is_active ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-600 border-red-600">Inactive</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">Order: {feature.menu_order}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogMode === "add" ? "Add Feature" : "Edit Feature"}</DialogTitle>
            <DialogDescription>
              {dialogMode === "add" ? "Add a new feature to the marketplace" : "Update feature details"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Feature Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    name: e.target.value,
                    slug: dialogMode === "add" ? generateSlug(e.target.value) : formData.slug,
                  });
                }}
                placeholder="e.g., Shipping"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL identifier)</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="e.g., shipping"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this feature does..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="icon">Icon</Label>
              <Select value={formData.icon} onValueChange={(value) => setFormData({ ...formData, icon: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an icon" />
                </SelectTrigger>
                <SelectContent>
                  {iconOptions.map((option) => {
                    const IconComp = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <IconComp className="h-4 w-4" />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_free">Free Feature</Label>
              <Switch
                id="is_free"
                checked={formData.is_free}
                onCheckedChange={(checked) => setFormData({ ...formData, is_free: checked })}
              />
            </div>
            {!formData.is_free && (
              <div className="space-y-2">
                <Label htmlFor="price">Price (₹)</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Active</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="menu_order">Menu Order</Label>
              <Input
                id="menu_order"
                type="number"
                value={formData.menu_order}
                onChange={(e) => setFormData({ ...formData, menu_order: parseInt(e.target.value) || 0 })}
                placeholder="1"
              />
            </div>

            {/* Google Reviews Specific Pricing & Quota */}
            {formData.slug === 'google-reviews' && (
              <>
                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-semibold text-sm">Google Reviews Pricing & API Quota</h4>

                  <div className="space-y-2">
                    <Label htmlFor="pricing_model">Pricing Model</Label>
                    <Select
                      value={formData.pricing_model}
                      onValueChange={(value) => setFormData({ ...formData, pricing_model: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="onetime">One-time Only</SelectItem>
                        <SelectItem value="monthly">Monthly Only</SelectItem>
                        <SelectItem value="yearly">Yearly Only</SelectItem>
                        <SelectItem value="mixed">Mixed (All Options)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(formData.pricing_model === 'onetime' || formData.pricing_model === 'mixed') && (
                    <div className="grid grid-cols-2 gap-4 p-3 border rounded-lg">
                      <div className="space-y-2">
                        <Label htmlFor="price_onetime">One-time Price (₹)</Label>
                        <Input
                          id="price_onetime"
                          type="number"
                          value={formData.price_onetime}
                          onChange={(e) => setFormData({ ...formData, price_onetime: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quota_onetime">API Calls/Month</Label>
                        <Input
                          id="quota_onetime"
                          type="number"
                          value={formData.quota_onetime}
                          onChange={(e) => setFormData({ ...formData, quota_onetime: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  )}

                  {(formData.pricing_model === 'monthly' || formData.pricing_model === 'mixed') && (
                    <div className="grid grid-cols-2 gap-4 p-3 border rounded-lg">
                      <div className="space-y-2">
                        <Label htmlFor="price_monthly">Monthly Price (₹)</Label>
                        <Input
                          id="price_monthly"
                          type="number"
                          value={formData.price_monthly}
                          onChange={(e) => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quota_monthly">API Calls/Month</Label>
                        <Input
                          id="quota_monthly"
                          type="number"
                          value={formData.quota_monthly}
                          onChange={(e) => setFormData({ ...formData, quota_monthly: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  )}

                  {(formData.pricing_model === 'yearly' || formData.pricing_model === 'mixed') && (
                    <div className="grid grid-cols-2 gap-4 p-3 border rounded-lg">
                      <div className="space-y-2">
                        <Label htmlFor="price_yearly">Yearly Price (₹)</Label>
                        <Input
                          id="price_yearly"
                          type="number"
                          value={formData.price_yearly}
                          onChange={(e) => setFormData({ ...formData, price_yearly: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quota_yearly">API Calls/Month</Label>
                        <Input
                          id="quota_yearly"
                          type="number"
                          value={formData.quota_yearly}
                          onChange={(e) => setFormData({ ...formData, quota_yearly: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveFeature} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {dialogMode === "add" ? "Add Feature" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feature?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the feature from the marketplace. Store owners who have enabled this feature will lose access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFeature} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SuperadminMarketplace;
