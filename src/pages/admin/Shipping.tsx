import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Truck, Package, Settings, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff, ExternalLink, Power, KeyRound, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { shiprocketLogin, shiprocketGetPickupLocations } from "@/lib/shiprocket";
import {
  disconnectShippingProvider,
  getShippingIntegrations,
  saveDelhiveryIntegration,
  ShippingEnvironment,
  ShippingIntegration,
  testShippingProvider,
  toggleShippingProvider,
} from "@/lib/shippingIntegrations";

interface PickupLocation {
  id: number;
  pickup_location: string;
  address: string;
  city: string;
  state: string;
  pin_code: string;
  phone: string;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
};

const AdminShipping = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [shippingEnabled, setShippingEnabled] = useState(false);
  const [shippingProviderFeatures, setShippingProviderFeatures] = useState<string[]>([]);
  const [togglingEnabled, setTogglingEnabled] = useState(false);
  const [delhiveryIntegration, setDelhiveryIntegration] = useState<ShippingIntegration | null>(null);
  const [delhiverySaving, setDelhiverySaving] = useState(false);
  const [delhiveryTesting, setDelhiveryTesting] = useState(false);
  const [delhiveryDisconnecting, setDelhiveryDisconnecting] = useState(false);
  const [delhiveryToken, setDelhiveryToken] = useState("");
  const [showDelhiveryToken, setShowDelhiveryToken] = useState(false);
  const [delhiveryForm, setDelhiveryForm] = useState({
    clientName: "",
    pickupLocation: "",
    environment: "production" as ShippingEnvironment,
  });

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
        .select('id, shiprocket_email, shiprocket_token, shiprocket_pickup_location, package_length, package_breadth, package_height, package_weight, shipping_popup_enabled, enabled_features')
        .eq('user_id', session.user.id)
        .single();

      if (store) {
        setStoreId(store.id);
        setShippingEnabled(store.shipping_popup_enabled || false);
        setShippingProviderFeatures((store.enabled_features as string[]) || []);

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

        try {
          const integrationsResult = await getShippingIntegrations(store.id);
          const delhivery = integrationsResult.integrations.find((item) => item.provider === "delhivery") || null;
          setDelhiveryIntegration(delhivery);
          if (delhivery) {
            setDelhiveryForm({
              clientName: delhivery.client_name || "",
              pickupLocation: delhivery.pickup_location || "",
              environment: delhivery.environment || "production",
            });
          }
        } catch (integrationError) {
          console.warn("Error loading shipping integrations:", integrationError);
        }
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
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to test connection"),
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
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to connect to Shiprocket"),
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
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to disconnect"),
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
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to update setting"),
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
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to save package defaults"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDelhivery = async () => {
    if (!storeId) return;

    if (!delhiveryToken.trim()) {
      toast({
        title: "Error",
        description: "Please enter your Delhivery API token",
        variant: "destructive",
      });
      return;
    }

    setDelhiverySaving(true);
    try {
      const result = await saveDelhiveryIntegration({
        storeId,
        apiToken: delhiveryToken,
        clientName: delhiveryForm.clientName,
        pickupLocation: delhiveryForm.pickupLocation,
        environment: delhiveryForm.environment,
      });

      setDelhiveryIntegration(result.integration);
      setDelhiveryToken("");

      toast({
        title: "Delhivery Connected",
        description: "Token tested and saved securely",
      });
    } catch (error: unknown) {
      toast({
        title: "Delhivery Error",
        description: getErrorMessage(error, "Failed to connect Delhivery"),
        variant: "destructive",
      });
    } finally {
      setDelhiverySaving(false);
    }
  };

  const handleTestDelhivery = async () => {
    if (!storeId || !delhiveryIntegration) return;

    setDelhiveryTesting(true);
    try {
      const result = await testShippingProvider(storeId, "delhivery");
      setDelhiveryIntegration(result.integration);
      toast({
        title: "Connection Successful",
        description: "Delhivery API token is valid",
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Delhivery token test failed");
      setDelhiveryIntegration(prev => prev ? { ...prev, status: "invalid", last_error: message } : prev);
      toast({
        title: "Connection Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setDelhiveryTesting(false);
    }
  };

  const handleToggleDelhivery = async (enabled: boolean) => {
    if (!storeId || !delhiveryIntegration) return;

    setDelhiverySaving(true);
    try {
      const result = await toggleShippingProvider(storeId, "delhivery", enabled);
      setDelhiveryIntegration(result.integration);
      toast({
        title: enabled ? "Delhivery Enabled" : "Delhivery Disabled",
        description: enabled ? "Delhivery can be used for future shipment actions" : "Delhivery will not appear as an active provider",
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to update Delhivery"),
        variant: "destructive",
      });
    } finally {
      setDelhiverySaving(false);
    }
  };

  const handleDisconnectDelhivery = async () => {
    if (!storeId) return;

    setDelhiveryDisconnecting(true);
    try {
      await disconnectShippingProvider(storeId, "delhivery");
      setDelhiveryIntegration(null);
      setDelhiveryToken("");
      setDelhiveryForm({
        clientName: "",
        pickupLocation: "",
        environment: "production",
      });

      toast({
        title: "Disconnected",
        description: "Delhivery has been removed from your store",
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to disconnect Delhivery"),
        variant: "destructive",
      });
    } finally {
      setDelhiveryDisconnecting(false);
    }
  };

  const hasShiprocketProvider = shippingProviderFeatures.includes("shipping");
  const hasDelhiveryProvider = shippingProviderFeatures.includes("delhivery");
  const hasAnyShippingProvider = hasShiprocketProvider || hasDelhiveryProvider;
  const hasConnectedProvider =
    (hasShiprocketProvider && isConnected) ||
    (hasDelhiveryProvider && delhiveryIntegration?.status === "connected");

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="h-6 w-6" />
              Shipping
            </h1>
            <p className="text-muted-foreground">
              Manage installed shipping providers for your store
            </p>
          </div>
          {hasConnectedProvider && (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>

        {!hasAnyShippingProvider && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <Truck className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No shipping provider installed</h3>
                <p className="text-sm text-muted-foreground">
                  Install Shiprocket or Delhivery from Marketplace to configure shipping.
                </p>
              </div>
              <Button onClick={() => navigate("/admin/marketplace")}>
                Open Marketplace
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Enable/Disable Toggle Card */}
        {hasAnyShippingProvider && (
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
        )}

        {/* Connection Card */}
        {hasShiprocketProvider && (
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
        )}

        {/* Delhivery Connection Card */}
        {hasDelhiveryProvider && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {delhiveryIntegration?.status === "connected" ? (
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                  ) : (
                    <KeyRound className="h-5 w-5" />
                  )}
                  Delhivery
                </CardTitle>
                <CardDescription>
                  Save a store owner's Delhivery API token securely for future shipment automation.
                </CardDescription>
              </div>
              {delhiveryIntegration && (
                <Badge
                  variant="outline"
                  className={
                    delhiveryIntegration.status === "connected"
                      ? "text-green-600 border-green-600"
                      : delhiveryIntegration.status === "invalid"
                        ? "text-destructive border-destructive"
                        : "text-muted-foreground"
                  }
                >
                  {delhiveryIntegration.status === "connected"
                    ? "Connected"
                    : delhiveryIntegration.status === "invalid"
                      ? "Invalid"
                      : delhiveryIntegration.status === "disabled"
                        ? "Disabled"
                        : "Not Connected"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Delhivery tokens are sent once to the backend, encrypted, and only the last 4 characters are shown here.
              </AlertDescription>
            </Alert>

            {delhiveryIntegration && (
              <div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">
                    Token: {delhiveryIntegration.token_last4 ? `********${delhiveryIntegration.token_last4}` : "Saved"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {delhiveryIntegration.last_tested_at
                      ? `Last tested ${new Date(delhiveryIntegration.last_tested_at).toLocaleString()}`
                      : "Connection has not been tested yet"}
                  </p>
                  {delhiveryIntegration.last_error && (
                    <p className="mt-1 text-sm text-destructive">{delhiveryIntegration.last_error}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${delhiveryIntegration.enabled ? "text-green-600" : "text-muted-foreground"}`}>
                    {delhiveryIntegration.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <Switch
                    checked={delhiveryIntegration.enabled}
                    onCheckedChange={handleToggleDelhivery}
                    disabled={delhiverySaving}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="delhivery-client">Client Name / HQ Name</Label>
                <Input
                  id="delhivery-client"
                  placeholder="Your Delhivery client name"
                  value={delhiveryForm.clientName}
                  onChange={(e) => setDelhiveryForm({ ...delhiveryForm, clientName: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Find it in Delhivery One top-right account selector under Domestic.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="delhivery-pickup">Pickup Location / Warehouse</Label>
                <Input
                  id="delhivery-pickup"
                  placeholder="Registered warehouse name"
                  value={delhiveryForm.pickupLocation}
                  onChange={(e) => setDelhiveryForm({ ...delhiveryForm, pickupLocation: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="delhivery-environment">Environment</Label>
                <select
                  id="delhivery-environment"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={delhiveryForm.environment}
                  onChange={(e) => setDelhiveryForm({ ...delhiveryForm, environment: e.target.value as ShippingEnvironment })}
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="delhivery-token">
                  {delhiveryIntegration ? "Replace Delhivery API Token" : "Delhivery API Token"}
                </Label>
                <div className="relative">
                  <Input
                    id="delhivery-token"
                    type={showDelhiveryToken ? "text" : "password"}
                    placeholder={delhiveryIntegration ? "Paste new token to replace" : "Paste Delhivery API token"}
                    value={delhiveryToken}
                    onChange={(e) => setDelhiveryToken(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowDelhiveryToken(!showDelhiveryToken)}
                  >
                    {showDelhiveryToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveDelhivery} disabled={delhiverySaving || !delhiveryToken.trim()}>
                {delhiverySaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {delhiveryIntegration ? "Replace Token" : "Connect Delhivery"}
              </Button>
              {delhiveryIntegration && (
                <>
                  <Button variant="outline" onClick={handleTestDelhivery} disabled={delhiveryTesting}>
                    {delhiveryTesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Test Saved Token
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open("https://one.delhivery.com/", "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Delhivery One
                  </Button>
                  <Button variant="destructive" onClick={handleDisconnectDelhivery} disabled={delhiveryDisconnecting}>
                    {delhiveryDisconnecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Disconnect
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Package Defaults */}
        {hasShiprocketProvider && isConnected && (
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
        {hasAnyShippingProvider && (
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
        )}
      </div>
  );
};

export default AdminShipping;
