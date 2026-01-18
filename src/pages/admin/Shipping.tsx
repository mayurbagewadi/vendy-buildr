import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Truck, Package, Settings, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AdminShipping = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: store } = await supabase
        .from('stores')
        .select('shiprocket_token')
        .eq('user_id', session.user.id)
        .single();

      if (store?.shiprocket_token) {
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!credentials.email || !credentials.password) {
      toast({
        title: "Error",
        description: "Please enter your Shiprocket credentials",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // In a real implementation, this would call Shiprocket API to get token
      // For now, we'll just save a placeholder
      toast({
        title: "Coming Soon",
        description: "Shiprocket integration is being set up. Please check back later.",
      });
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase
        .from('stores')
        .update({ shiprocket_token: null })
        .eq('user_id', session.user.id);

      setIsConnected(false);
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

        {/* Connection Status */}
        {isConnected ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Shiprocket Connected
              </CardTitle>
              <CardDescription>
                Your store is connected to Shiprocket. You can now create shipments for your orders.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Package className="h-8 w-8 mx-auto text-primary mb-2" />
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-sm text-muted-foreground">Pending Shipments</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Truck className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-sm text-muted-foreground">In Transit</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-sm text-muted-foreground">Delivered</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={handleDisconnect}>
                  Disconnect Shiprocket
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Connect to Shiprocket</CardTitle>
              <CardDescription>
                Enter your Shiprocket credentials to connect your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                </AlertDescription>
              </Alert>

              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="email">Shiprocket Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={credentials.email}
                    onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Shiprocket Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  />
                </div>
                <Button onClick={handleConnect} disabled={saving} className="w-full">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Connect Shiprocket
                </Button>
              </div>
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
