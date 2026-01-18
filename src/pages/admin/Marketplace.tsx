import { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Package, Truck, BarChart3, MessageSquare, Mail, Target, Loader2, Check, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
}

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

interface StoreData {
  id: string;
  enabled_features: string[];
}

type FilterType = 'all' | 'free' | 'paid' | 'enabled' | 'disabled';

const AdminMarketplace = () => {
  const { toast } = useToast();
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [features, setFeatures] = useState<MarketplaceFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingFeature, setTogglingFeature] = useState<string | null>(null);
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  useEffect(() => {
    fetchStoreData();
    fetchFeatures();
  }, []);

  const fetchStoreData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: store, error } = await supabase
        .from('stores')
        .select('id, enabled_features')
        .eq('user_id', session.user.id)
        .single();

      if (error) throw error;

      if (store) {
        setStoreData({
          id: store.id,
          enabled_features: (store.enabled_features as string[]) || []
        });
        setEnabledFeatures((store.enabled_features as string[]) || []);
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

  // Filter and search features
  const filteredFeatures = useMemo(() => {
    return features.filter((feature) => {
      // Search filter
      const matchesSearch = searchQuery === "" ||
        feature.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feature.description?.toLowerCase().includes(searchQuery.toLowerCase());

      // Category filter
      let matchesFilter = true;
      switch (activeFilter) {
        case 'free':
          matchesFilter = feature.is_free;
          break;
        case 'paid':
          matchesFilter = !feature.is_free;
          break;
        case 'enabled':
          matchesFilter = enabledFeatures.includes(feature.slug);
          break;
        case 'disabled':
          matchesFilter = !enabledFeatures.includes(feature.slug);
          break;
        default:
          matchesFilter = true;
      }

      return matchesSearch && matchesFilter;
    });
  }, [features, searchQuery, activeFilter, enabledFeatures]);

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'free', label: 'Free' },
    { value: 'paid', label: 'Paid' },
    { value: 'enabled', label: 'Enabled' },
    { value: 'disabled', label: 'Disabled' },
  ];

  const toggleFeature = async (feature: MarketplaceFeature) => {
    if (!storeData?.id) return;

    setTogglingFeature(feature.slug);

    try {
      const isCurrentlyEnabled = isFeatureEnabled(feature.slug);
      let newEnabledFeatures: string[];

      if (isCurrentlyEnabled) {
        // Remove feature
        newEnabledFeatures = enabledFeatures.filter(f => f !== feature.slug);
      } else {
        // Add feature
        newEnabledFeatures = [...enabledFeatures, feature.slug];
      }

      const { error } = await supabase
        .from('stores')
        .update({ enabled_features: newEnabledFeatures })
        .eq('id', storeData.id);

      if (error) throw error;

      setEnabledFeatures(newEnabledFeatures);

      toast({
        title: isCurrentlyEnabled ? "Feature Disabled" : "Feature Enabled",
        description: isCurrentlyEnabled
          ? `${feature.name} has been removed from your store`
          : `${feature.name} has been added to your store`,
      });

      // Reload page to update sidebar
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update feature",
        variant: "destructive",
      });
    } finally {
      setTogglingFeature(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Marketplace</h1>
          <p className="text-muted-foreground">
            Add features to enhance your store. Enable or disable features as needed.
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter Buttons */}
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
              const isEnabled = isFeatureEnabled(feature.slug);
              const isToggling = togglingFeature === feature.slug;

              return (
                <Card
                  key={feature.id}
                  className={`transition-all duration-200 ${isEnabled ? 'ring-2 ring-primary' : ''}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isEnabled ? 'bg-primary text-primary-foreground' : 'bg-primary/10'}`}>
                          <IconComponent className={`h-6 w-6 ${isEnabled ? '' : 'text-primary'}`} />
                        </div>
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {feature.name}
                            {isEnabled && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </CardTitle>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {feature.is_free ? (
                          <Badge variant="secondary">Free</Badge>
                        ) : (
                          <Badge variant="default">₹{feature.price}</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mb-4">
                      {feature.description}
                    </CardDescription>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                      {isToggling ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => toggleFeature(feature)}
                        />
                      )}
                    </div>
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
                  Enable features to add new capabilities to your store. Each feature adds a new menu item
                  to your sidebar. You can disable features at any time to simplify your dashboard.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminMarketplace;
