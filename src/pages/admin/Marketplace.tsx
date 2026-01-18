import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Package, Truck, BarChart3, MessageSquare, Mail, Target, Loader2, Search, Plus, ArrowRight, CheckCircle2 } from "lucide-react";
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
  enabled_features: string[];
}

type FilterType = 'all' | 'free' | 'paid' | 'added';

const AdminMarketplace = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [features, setFeatures] = useState<MarketplaceFeature[]>([]);
  const [loading, setLoading] = useState(true);
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
      const matchesSearch = searchQuery === "" ||
        feature.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feature.description?.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesFilter = true;
      switch (activeFilter) {
        case 'free':
          matchesFilter = feature.is_free;
          break;
        case 'paid':
          matchesFilter = !feature.is_free;
          break;
        case 'added':
          matchesFilter = enabledFeatures.includes(feature.slug);
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
    { value: 'added', label: 'Added' },
  ];

  const handleAddFeature = (feature: MarketplaceFeature) => {
    navigate(getFeatureRoute(feature.slug));
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
            Discover and add features to enhance your store
          </p>
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
                        {isAdded && (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Added
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
                    <Button
                      onClick={() => handleAddFeature(feature)}
                      className="w-full"
                      variant={isAdded ? "outline" : "default"}
                    >
                      {isAdded ? (
                        <>
                          Configure
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Feature
                        </>
                      )}
                    </Button>
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
                  Click "Add Feature" to go to the feature page where you can configure and enable it.
                  Once enabled, the feature will appear in your sidebar menu.
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
