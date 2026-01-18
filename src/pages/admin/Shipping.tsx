import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Truck, Package, Settings, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff, ExternalLink, Power } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { shiprocketLogin, shiprocketGetPickupLocations } from "@/lib/shiprocket";

interface PickupLocation {
  id: number;
  pickup_location: string;
  address: string;
  city: string;
  state: string;
  pin_code: string;
  phone: string;
}

const AdminShipping = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [shippingEnabled, setShippingEnabled] = useState(false);
  const [togglingEnabled, setTogglingEnabled] = useState(false);

  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });

  const [packageDefaults, setPackageDefaults] = useState({
    length: 10,
    breadth: 10,
    height: 10,
    weight: 0.5,
  });

  useEffect(() => {
    loadShippingSettings();
  }, []);

  const loadShippingSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: store } = await supabase
        .from('stores')
        .select('id, shiprocket_email, shiprocket_token, shiprocket_pickup_location, package_length, package_breadth, package_height, package_weight, shipping_popup_enabled')
        .eq('user_id', session.user.id)
        .single();

      if (store) {
        setStoreId(store.id);
        setShippingEnabled(store.shipping_popup_enabled || false);

        if (store.shiprocket_email) {
          setCredentials(prev => ({ ...prev, email: store.shiprocket_email }));
        }

        if (store.shiprocket_token) {
          setIsConnected(true);
          // Load pickup locations
          const result = await shiprocketGetPickupLocations(store.shiprocket_token);
          if (result.success && result.locations) {
            setPickupLocations(result.locations);
          }
        }

        if (store.package_length) setPackageDefaults(prev => ({ ...prev, length: store.package_length }));
        if (store.package_breadth) setPackageDefaults(prev => ({ ...prev, breadth: store.package_breadth }));
        if (store.package_height) setPackageDefaults(prev => ({ ...prev, height: store.package_height }));
        if (store.package_weight) setPackageDefaults(prev => ({ ...prev, weight: store.package_weight }));
      }
    } catch (error) {
      console.error('Error loading shipping settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!credentials.email || !credentials.password) {
      toast({
        title: "Error",
        description: "Please enter your Shiprocket email and password",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const result = await shiprocketLogin(credentials.email, credentials.password);

      if (result.success && result.token) {
        toast({
          title: "Connection Successful",
          description: "Shiprocket credentials are valid",
        });

        // Load pickup locations
        const locationsResult = await shiprocketGetPickupLocations(result.token);
        if (locationsResult.success && locationsResult.locations) {
          setPickupLocations(locationsResult.locations);
        }
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "Invalid credentials",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to test connection",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    if (!credentials.email || !credentials.password) {
      toast({
        title: "Error",
        description: "Please enter your Shiprocket email and password",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const result = await shiprocketLogin(credentials.email, credentials.password);

      if (result.success && result.token) {
        // Save to database
        const { error } = await supabase
          .from('stores')
          .update({
            shiprocket_email: credentials.email,
            shiprocket_token: result.token,
          })
          .eq('id', storeId);

        if (error) throw error;

        setIsConnected(true);

        // Load pickup locations
        const locationsResult = await shiprocketGetPickupLocations(result.token);
        if (locationsResult.success && locationsResult.locations) {
          setPickupLocations(locationsResult.locations);
        }

        toast({
          title: "Connected",
          description: "Shiprocket has been connected to your store",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "Invalid credentials",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to connect to Shiprocket",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { error } = await supabase
        .from('stores')
        .update({
          shiprocket_email: null,
          shiprocket_token: null,
        })
        .eq('id', storeId);

      if (error) throw error;

      setIsConnected(false);
      setCredentials({ email: "", password: "" });
      setPickupLocations([]);

      toast({
        title: "Disconnected",
        description: "Shiprocket has been disconnected from your store",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect",
        variant: "destructive",
      });
    }
  };

  const handleToggleShipping = async (enabled: boolean) => {
    setTogglingEnabled(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update({ shipping_popup_enabled: enabled })
        .eq('id', storeId);

      if (error) throw error;

      setShippingEnabled(enabled);
      toast({
        title: enabled ? "Shipping Enabled" : "Shipping Disabled",
        description: enabled
          ? "Shipping popup will appear in Orders"
          : "Orders will be marked as delivered directly",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update setting",
        variant: "destructive",
      });
    } finally {
      setTogglingEnabled(false);
    }
  };

  const handleSavePackageDefaults = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update({
          package_length: packageDefaults.length,
          package_breadth: packageDefaults.breadth,
          package_height: packageDefaults.height,
          package_weight: packageDefaults.weight,
        })
        .eq('id', storeId);

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Package defaults have been saved",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save package defaults",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="h-6 w-6" />
              Shipping
            </h1>
            <p className="text-muted-foreground">
              Connect Shiprocket to manage shipping for your orders
            </p>
          </div>
          {isConnected && (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>

        {/* Enable/Disable Toggle Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${shippingEnabled ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}`}>
                  <Power className={`h-6 w-6 ${shippingEnabled ? 'text-green-600' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <h3 className="font-semibold">Shipping Feature</h3>
                  <p className="text-sm text-muted-foreground">
                    {shippingEnabled
                      ? "Enabled - Shipping popup will appear in Orders"
                      : "Disabled - Orders will be marked as delivered directly"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${shippingEnabled ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {shippingEnabled ? 'Enabled' : 'Disabled'}
                </span>
                <Switch
                  checked={shippingEnabled}
                  onCheckedChange={handleToggleShipping}
                  disabled={togglingEnabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connection Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isConnected ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <Truck className="h-5 w-5" />
              )}
              {isConnected ? "Shiprocket Connected" : "Connect to Shiprocket"}
            </CardTitle>
            <CardDescription>
              {isConnected
                ? "Your store is connected to Shiprocket. You can now create shipments for your orders."
                : "Enter your Shiprocket API credentials to connect your account"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isConnected && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Don't have a Shiprocket account?{" "}
                  <a
                    href="https://www.shiprocket.in/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Sign up here
                  </a>
                  . Then go to Settings → API → Configure to create API credentials.
                </AlertDescription>
              </Alert>
            )}

            {isConnected ? (
              <>
                {/* Connected Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <Package className="h-8 w-8 mx-auto text-primary mb-2" />
                        <p className="text-2xl font-bold">{pickupLocations.length}</p>
                        <p className="text-sm text-muted-foreground">Pickup Locations</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <Truck className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                        <p className="text-2xl font-bold">Ready</p>
                        <p className="text-sm text-muted-foreground">Shipping Status</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                        <p className="text-2xl font-bold">Active</p>
                        <p className="text-sm text-muted-foreground">Connection</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Pickup Locations */}
                {pickupLocations.length > 0 && (
                  <div className="space-y-2">
                    <Label>Pickup Locations</Label>
                    <div className="space-y-2">
                      {pickupLocations.map((location) => (
                        <div key={location.id} className="p-3 border rounded-lg text-sm">
                          <p className="font-medium">{location.pickup_location}</p>
                          <p className="text-muted-foreground">
                            {location.address}, {location.city}, {location.state} - {location.pin_code}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => window.open("https://app.shiprocket.in/", "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Shiprocket Dashboard
                  </Button>
                  <Button variant="destructive" onClick={handleDisconnect}>
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="email">Shiprocket API Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your-api-user@email.com"
                    value={credentials.email}
                    onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use the API user email from Settings → API → Configure
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Shiprocket API Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={credentials.password}
                      onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Check your email for the API password from Shiprocket
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
                    {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Test Connection
                  </Button>
                  <Button onClick={handleConnect} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Connect Shiprocket
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Package Defaults */}
        {isConnected && (
          <Card>
            <CardHeader>
              <CardTitle>Default Package Dimensions</CardTitle>
              <CardDescription>
                Set default package dimensions for your shipments (can be changed per order)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="length">Length (cm)</Label>
                  <Input
                    id="length"
                    type="number"
                    value={packageDefaults.length}
                    onChange={(e) => setPackageDefaults({ ...packageDefaults, length: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="breadth">Breadth (cm)</Label>
                  <Input
                    id="breadth"
                    type="number"
                    value={packageDefaults.breadth}
                    onChange={(e) => setPackageDefaults({ ...packageDefaults, breadth: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    value={packageDefaults.height}
                    onChange={(e) => setPackageDefaults({ ...packageDefaults, height: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    value={packageDefaults.weight}
                    onChange={(e) => setPackageDefaults({ ...packageDefaults, weight: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <Button onClick={handleSavePackageDefaults} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Defaults
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Features Info */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">What you can do with Shipping</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Create shipments directly from your orders</li>
                  <li>• Get real-time tracking updates</li>
                  <li>• Compare shipping rates from multiple couriers</li>
                  <li>• Print shipping labels with one click</li>
                  <li>• Automatic order status updates</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminShipping;
