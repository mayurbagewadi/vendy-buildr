import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Package, Truck, BarChart3, MessageSquare, Mail, Target, Loader2, Search, Plus, ArrowRight, CheckCircle2, Trash2, Palette, Puzzle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MarketplacePaymentModal } from "@/components/marketplace/MarketplacePaymentModal";
import { ThemePreviewModal } from "@/components/marketplace/ThemePreviewModal";
import { checkExistingPurchase, enableFreeFeature } from "@/lib/marketplace/paymentService";
import {
  BUILT_IN_MARKETPLACE_THEMES,
  DEFAULT_STOREFRONT_TEMPLATE,
  resolveThemePreset,
  resolveThemeTemplate,
  type ThemePreset,
} from "@/lib/themeRegistry";

interface MarketplaceFeature {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  item_type?: string | null;
  is_free: boolean;
  price: number;
  is_active: boolean;
  menu_order: number;
}

const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, any> = {
    Truck,
    BarChart3,
    MessageSquare,
    Mail,
    Target,
    Package,
    Palette,
    Puzzle,
  };
  return iconMap[iconName] || Package;
};

// Map feature slugs to their routes
const getFeatureRoute = (slug: string): string => {
  const routeMap: Record<string, string> = {
    'shipping': '/admin/shipping',
    'analytics': '/admin/analytics',
    'live-chat': '/admin/live-chat',
    'email-marketing': '/admin/email-marketing',
    'ads': '/admin/ads',
  };
  return routeMap[slug] || `/admin/${slug}`;
};

interface StoreData {
  id: string;
  slug: string;
  storefront_theme: string | null;
  storefront_color_palette: string | null;
  storefront_template: string | null;
  enabled_features: string[];
}

type FilterType = 'all' | 'free' | 'paid' | 'added';
type MarketplaceItemTypeFilter = 'all' | 'feature' | 'theme' | 'plugin';

const BUILT_IN_THEME_FEATURES: Array<MarketplaceFeature & { theme_preset: ThemePreset; theme_version: string }> =
  BUILT_IN_MARKETPLACE_THEMES.map((theme) => ({
    id: `built-in-theme-${theme.id}`,
    name: theme.name,
    slug: theme.slug,
    description: theme.description,
    icon: theme.icon,
    item_type: "theme",
    is_free: theme.isFree,
    price: theme.price,
    is_active: true,
    menu_order: 0,
    theme_preset: theme.preset,
    theme_version: theme.version,
  }));

const AdminMarketplace = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [features, setFeatures] = useState<MarketplaceFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingFeature, setAddingFeature] = useState<string | null>(null);
  const [removingFeature, setRemovingFeature] = useState<string | null>(null);
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [activeItemTypeFilter, setActiveItemTypeFilter] = useState<MarketplaceItemTypeFilter>('all');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedFeatureForPayment, setSelectedFeatureForPayment] = useState<MarketplaceFeature | null>(null);
  const [themePreviewOpen, setThemePreviewOpen] = useState(false);
  const [selectedThemeForPreview, setSelectedThemeForPreview] = useState<(MarketplaceFeature & { theme_preset: ThemePreset; theme_version?: string }) | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    fetchStoreData();
    fetchFeatures();
  }, []);

  const fetchStoreData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setUserId(session.user.id);

      const { data: store, error } = await supabase
        .from('stores')
        .select('id, slug, storefront_theme, storefront_color_palette, storefront_template, enabled_features')
        .eq('user_id', session.user.id)
        .single();

      if (error) throw error;

      if (store) {
        setStoreData({
          id: store.id,
          slug: store.slug,
          storefront_theme: store.storefront_theme,
          storefront_color_palette: store.storefront_color_palette,
          storefront_template: store.storefront_template ?? "default",
          enabled_features: (store.enabled_features as string[]) || []
        });
        setEnabledFeatures((store.enabled_features as string[]) || []);
      }

      // Fetch customer details for payment
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (profile) {
        setCustomerDetails({
          name: profile.full_name || session.user.email || '',
          email: profile.email || session.user.email || '',
          phone: profile.phone || '',
        });
      } else {
        setCustomerDetails({
          name: session.user.email || '',
          email: session.user.email || '',
          phone: '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch store data:', error);
    }
  };

  const fetchFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from('marketplace_features')
        .select('*')
        .eq('is_active', true)
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

  const isFeatureEnabled = (slug: string) => {
    return enabledFeatures.includes(slug);
  };

  const bustStoreCache = () => {
    if (storeData?.slug) {
      sessionStorage.removeItem(`dd_sf_${storeData.slug}`);
    }
  };

  const themeItems = useMemo(() => {
    const merged = [...BUILT_IN_THEME_FEATURES, ...features];
    const deduped = new Map<string, MarketplaceFeature | (MarketplaceFeature & { theme_preset: ThemePreset; theme_version?: string })>();

    for (const feature of merged) {
      deduped.set(feature.slug, feature as any);
    }

    return Array.from(deduped.values());
  }, [features]);

  // Filter and search features
  const filteredFeatures = useMemo(() => {
    return themeItems.filter((feature) => {
      const itemType = (feature.item_type || 'feature') as MarketplaceItemTypeFilter;
      const matchesSearch = searchQuery === "" ||
        feature.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feature.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesItemType = activeItemTypeFilter === 'all' || itemType === activeItemTypeFilter;

      let matchesFilter = true;
      switch (activeFilter) {
        case 'free':
          matchesFilter = feature.is_free;
          break;
        case 'paid':
          matchesFilter = !feature.is_free;
          break;
        case 'added':
          if (itemType === 'theme') {
            const themeFeature = feature as MarketplaceFeature & { theme_preset?: ThemePreset };
            const preset = resolveThemePreset(themeFeature.slug, themeFeature.theme_preset);
            matchesFilter =
              storeData?.storefront_theme === preset.theme &&
              storeData?.storefront_color_palette === preset.palette &&
              storeData?.storefront_template === resolveThemeTemplate(themeFeature.slug);
          } else {
            matchesFilter = enabledFeatures.includes(feature.slug);
          }
          break;
        default:
          matchesFilter = true;
      }

      return matchesSearch && matchesFilter && matchesItemType;
    });
  }, [
    themeItems,
    searchQuery,
    activeFilter,
    activeItemTypeFilter,
    enabledFeatures,
    storeData?.storefront_theme,
    storeData?.storefront_color_palette,
    storeData?.storefront_template,
  ]);

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'free', label: 'Free' },
    { value: 'paid', label: 'Paid' },
    { value: 'added', label: 'Added' },
  ];

  const toggleItemTypeFilter = (value: Exclude<MarketplaceItemTypeFilter, 'all'>) => {
    setActiveItemTypeFilter((current) => (current === value ? 'all' : value));
  };

  const handleAddFeature = async (feature: MarketplaceFeature) => {
    const isAdded = enabledFeatures.includes(feature.slug);

    // If already added, just navigate to configure
    if (isAdded) {
      navigate(getFeatureRoute(feature.slug));
      return;
    }

    if (!storeData) {
      toast({
        title: "Error",
        description: "Store data not found",
        variant: "destructive",
      });
      return;
    }

    setAddingFeature(feature.slug);

    try {
      // Check if feature is free
      if (feature.is_free) {
        // Free feature - add directly
        const result = await enableFreeFeature(storeData.id, feature.slug, enabledFeatures);

        if (result.success) {
          const newEnabledFeatures = [...enabledFeatures, feature.slug];
          setEnabledFeatures(newEnabledFeatures);
          setStoreData({ ...storeData, enabled_features: newEnabledFeatures });

          toast({
            title: "Feature Added",
            description: `${feature.name} has been added to your store`,
          });

          navigate(getFeatureRoute(feature.slug));
        } else {
          throw new Error(result.error);
        }
      } else {
        // Paid feature - check if already purchased
        const { purchased } = await checkExistingPurchase(storeData.id, feature.slug);

        if (purchased) {
          // Already purchased - just add to enabled_features
          const newEnabledFeatures = [...enabledFeatures, feature.slug];

          const { error } = await supabase
            .from('stores')
            .update({ enabled_features: newEnabledFeatures })
            .eq('id', storeData.id);

          if (error) throw error;

          setEnabledFeatures(newEnabledFeatures);
          setStoreData({ ...storeData, enabled_features: newEnabledFeatures });

          toast({
            title: "Feature Enabled",
            description: `${feature.name} has been enabled`,
          });

          navigate(getFeatureRoute(feature.slug));
        } else {
          // Not purchased - show payment modal
          setSelectedFeatureForPayment(feature);
          setPaymentModalOpen(true);
        }
      }
    } catch (error: any) {
      console.error('Failed to add feature:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add feature. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAddingFeature(null);
    }
  };

  const handleRemoveFeature = async (feature: MarketplaceFeature, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering handleAddFeature

    if (!storeData) {
      toast({
        title: "Error",
        description: "Store data not found",
        variant: "destructive",
      });
      return;
    }

    setRemovingFeature(feature.slug);

    try {
      const newEnabledFeatures = enabledFeatures.filter(f => f !== feature.slug);

      const { error } = await supabase
        .from('stores')
        .update({ enabled_features: newEnabledFeatures })
        .eq('id', storeData.id);

      if (error) throw error;

      // Update local state
      setEnabledFeatures(newEnabledFeatures);
      setStoreData({ ...storeData, enabled_features: newEnabledFeatures });

      toast({
        title: "Feature Removed",
        description: `${feature.name} has been removed from your store`,
      });
    } catch (error) {
      console.error('Failed to remove feature:', error);
      toast({
        title: "Error",
        description: "Failed to remove feature. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRemovingFeature(null);
    }
  };

  const handleThemePreview = (feature: MarketplaceFeature & { theme_preset?: ThemePreset }) => {
    const preset = resolveThemePreset(feature.slug, feature.theme_preset);
    const themeDefinition = BUILT_IN_MARKETPLACE_THEMES.find((theme) => theme.slug === feature.slug);
    setSelectedThemeForPreview({
      ...feature,
      theme_preset: preset,
      theme_version: themeDefinition?.version,
    });
    setThemePreviewOpen(true);
  };

  const handleInstallTheme = async (feature: MarketplaceFeature & { theme_preset?: ThemePreset }) => {
    if (!storeData) {
      toast({
        title: "Error",
        description: "Store data not found.",
        variant: "destructive",
      });
      return;
    }

    const preset = resolveThemePreset(feature.slug, feature.theme_preset);
    const template = resolveThemeTemplate(feature.slug);
    setAddingFeature(feature.slug);

    try {
      const { error } = await supabase
        .from("stores")
        .update({
          storefront_theme: preset.theme,
          storefront_color_palette: preset.palette,
          storefront_template: template,
        })
        .eq("id", storeData.id);

      if (error) throw error;

      setStoreData({
        ...storeData,
        storefront_theme: preset.theme,
        storefront_color_palette: preset.palette,
        storefront_template: template,
      });

      bustStoreCache();
      toast({
        title: "Theme Applied",
        description: `${feature.name} is now active on your store.`,
      });
      setThemePreviewOpen(false);
    } catch (error: any) {
      console.error("Failed to apply theme:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to apply theme. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAddingFeature(null);
    }
  };

  const handleUninstallTheme = async (feature: MarketplaceFeature & { theme_preset?: ThemePreset }) => {
    if (!storeData) {
      toast({
        title: "Error",
        description: "Store data not found.",
        variant: "destructive",
      });
      return;
    }

    setAddingFeature(feature.slug);

    try {
      const { error } = await supabase
        .from("stores")
        .update({
          storefront_theme: "dark",
          storefront_color_palette: "default",
          storefront_template: DEFAULT_STOREFRONT_TEMPLATE,
        })
        .eq("id", storeData.id);

      if (error) throw error;

      setStoreData({
        ...storeData,
        storefront_theme: "dark",
        storefront_color_palette: "default",
        storefront_template: DEFAULT_STOREFRONT_TEMPLATE,
      });

      bustStoreCache();
      toast({
        title: "Theme Reset",
        description: "Storefront reverted to the default theme.",
      });
    } catch (error: any) {
      console.error("Failed to uninstall theme:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to reset theme. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAddingFeature(null);
    }
  };

  const handlePaymentSuccess = async () => {
    if (!selectedFeatureForPayment || !storeData) return;

    try {
      // Add feature to enabled_features after successful payment
      const newEnabledFeatures = [...enabledFeatures, selectedFeatureForPayment.slug];

      const { error } = await supabase
        .from('stores')
        .update({ enabled_features: newEnabledFeatures })
        .eq('id', storeData.id);

      if (error) throw error;

      // Update local state
      setEnabledFeatures(newEnabledFeatures);
      setStoreData({ ...storeData, enabled_features: newEnabledFeatures });

      // Navigate to feature page
      navigate(getFeatureRoute(selectedFeatureForPayment.slug));
    } catch (error) {
      console.error('Failed to enable feature after payment:', error);
      toast({
        title: "Warning",
        description: "Payment successful but failed to enable feature. Please contact support.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Marketplace</h1>
          <p className="text-muted-foreground">
            Discover and add marketplace items to enhance your store
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeItemTypeFilter === 'theme' ? "default" : "outline"}
            size="sm"
            onClick={() => toggleItemTypeFilter('theme')}
          >
            <Palette className="h-4 w-4 mr-2" />
            Theme
          </Button>
          <Button
            variant={activeItemTypeFilter === 'plugin' ? "default" : "outline"}
            size="sm"
            onClick={() => toggleItemTypeFilter('plugin')}
          >
            <Puzzle className="h-4 w-4 mr-2" />
            Plugin
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                variant={activeFilter === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        {filteredFeatures.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery || activeFilter !== 'all' ? 'No matching features' : 'No features available'}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery || activeFilter !== 'all'
                  ? 'Try adjusting your search or filter'
                  : 'Check back later for new features'}
              </p>
              {(searchQuery || activeFilter !== 'all') && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveFilter('all');
                    setActiveItemTypeFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFeatures.map((feature) => {
              const IconComponent = getIconComponent(feature.icon);
              const isAdded = isFeatureEnabled(feature.slug);
              const itemType = (feature.item_type || 'feature').toLowerCase();
              const isTheme = itemType === 'theme';
              const isPlugin = itemType === 'plugin';
              const itemTypeLabel = itemType.charAt(0).toUpperCase() + itemType.slice(1);
              const themeFeature = feature as MarketplaceFeature & { theme_preset?: ThemePreset };
              const preset = resolveThemePreset(themeFeature.slug, themeFeature.theme_preset);
              const template = resolveThemeTemplate(themeFeature.slug);
              const isThemeApplied =
                isTheme &&
                storeData?.storefront_theme === preset.theme &&
                storeData?.storefront_color_palette === preset.palette &&
                storeData?.storefront_template === template;

              return (
                <Card
                  key={feature.id}
                  className={`transition-all duration-200 hover:shadow-lg ${isAdded ? 'border-primary/50' : ''}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className={`p-3 rounded-xl ${isAdded ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <IconComponent className="h-6 w-6" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {itemTypeLabel}
                        </Badge>
                        {isAdded && (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Added
                          </Badge>
                        )}
                        {isThemeApplied && (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Applied
                          </Badge>
                        )}
                        {feature.is_free ? (
                          <Badge variant="secondary">Free</Badge>
                        ) : (
                          <Badge>₹{feature.price}</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <CardTitle className="text-lg mb-1">{feature.name}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {feature.description}
                      </CardDescription>
                    </div>
                    {isTheme ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleThemePreview(themeFeature)}
                        >
                          Preview
                        </Button>
                        <Button
                          className="flex-1"
                          disabled={addingFeature === feature.slug}
                          onClick={() =>
                            isThemeApplied
                              ? handleUninstallTheme(themeFeature)
                              : handleInstallTheme(themeFeature)
                          }
                        >
                          {isThemeApplied
                            ? addingFeature === feature.slug
                              ? "Resetting..."
                              : "Uninstall Theme"
                            : addingFeature === feature.slug
                              ? "Applying..."
                              : "Install Theme"}
                        </Button>
                      </div>
                    ) : isPlugin ? (
                      isAdded ? (
                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            onClick={() => handleAddFeature(feature)}
                            variant="outline"
                          >
                            Configure
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={(e) => handleRemoveFeature(feature, e)}
                            disabled={removingFeature === feature.slug}
                          >
                            {removingFeature === feature.slug ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleAddFeature(feature)}
                          className="w-full"
                          disabled={addingFeature === feature.slug}
                        >
                          {addingFeature === feature.slug ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Plugin
                            </>
                          )}
                        </Button>
                      )
                    ) : isAdded ? (
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          onClick={() => handleAddFeature(feature)}
                          variant="outline"
                        >
                          Configure
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={(e) => handleRemoveFeature(feature, e)}
                          disabled={removingFeature === feature.slug}
                        >
                          {removingFeature === feature.slug ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleAddFeature(feature)}
                        className="w-full"
                        disabled={addingFeature === feature.slug}
                      >
                        {addingFeature === feature.slug ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Feature
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Info Section */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">How Marketplace Works</h3>
                <p className="text-sm text-muted-foreground">
                  Click "Add Feature" to add marketplace items to your store. Free items are added instantly.
                  Paid items require payment before activation. Plugin items use the existing install flow; theme items now have a preview and install path for testing the storefront look.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Modal */}
        {selectedFeatureForPayment && storeData && userId && (
          <MarketplacePaymentModal
            open={paymentModalOpen}
            onOpenChange={setPaymentModalOpen}
            feature={selectedFeatureForPayment}
            storeId={storeData.id}
            userId={userId}
            customerDetails={customerDetails}
            onSuccess={handlePaymentSuccess}
          />
        )}

        {selectedThemeForPreview && (
          <ThemePreviewModal
            open={themePreviewOpen}
            onOpenChange={setThemePreviewOpen}
            theme={selectedThemeForPreview}
            onInstall={() => handleInstallTheme(selectedThemeForPreview)}
            installing={addingFeature === selectedThemeForPreview.slug}
          />
        )}
      </div>
  );
};

export default AdminMarketplace;
