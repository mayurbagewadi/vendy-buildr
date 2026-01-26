import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HardDrive, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GoogleDriveSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [storeId, setStoreId] = useState<string | null>(null);

  useEffect(() => {
    loadStore();
  }, []);

  const loadStore = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/onboarding/store-setup");
        return;
      }

      // ✓ Capture new tokens from session after OAuth redirect
      const { data: { session } } = await supabase.auth.getSession();
      const providerToken = session?.provider_token;
      const providerRefreshToken = session?.provider_refresh_token;

      // Load store from database
      const { data: store, error } = await supabase
        .from("stores")
        .select("id, google_access_token, google_refresh_token")
        .eq("user_id", user.id)
        .single();

      if (error || !store) {
        console.error("Store not found");
        navigate("/onboarding/store-setup");
        return;
      }

      setStoreId(store.id);

      // ✓ If OAuth returned new tokens, save them to database
      if (providerToken && !store.google_access_token) {
        const updates: any = {
          google_access_token: providerToken,
        };

        // Save refresh token with 1 hour expiry if available
        if (providerRefreshToken) {
          const tokenExpiry = new Date(Date.now() + 3600 * 1000).toISOString();
          updates.google_refresh_token = providerRefreshToken;
          updates.google_token_expiry = tokenExpiry;
        }

        // Persist to stores table
        await supabase
          .from('stores')
          .update(updates)
          .eq('id', store.id);

        // Don't show success toast yet - verify connection first
      }

      // ✓ Always verify Drive connection with actual API call
      await verifyDriveConnection();
    } catch (error: any) {
      console.error("Error loading store:", error);
      setIsVerifying(false);
    }
  };

  const verifyDriveConnection = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsDriveConnected(false);
        setIsVerifying(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('verify-drive-connection', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      // Handle verification errors
      if (error) {
        console.error('Drive verification error:', error);
        setIsDriveConnected(false);
        setIsVerifying(false);
        return;
      }

      // ✓ Check verification response
      if (data?.connected) {
        setIsDriveConnected(true);

        // Only show success toast if we just connected (when there are new tokens)
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.provider_token) {
          toast({
            title: "Google Drive Connected",
            description: "You can now upload images from your device.",
          });
        }
      } else {
        setIsDriveConnected(false);
        console.log('Drive not connected:', data?.reason);
      }
    } catch (error: any) {
      console.error('Error verifying Drive connection:', error);
      setIsDriveConnected(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/drive.file',
          redirectTo: `${window.location.origin}/onboarding/google-drive`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsConnectingDrive(false);
    }
  };

  const handleContinue = async () => {
    try {
      navigate("/admin/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const advantages = [
    {
      title: "Unlimited Storage",
      description: "No storage limits on product images"
    },
    {
      title: "Automatic Backup",
      description: "Your images are safely backed up by Google"
    },
    {
      title: "Easy Management",
      description: "View and organize images directly in Google Drive"
    },
    {
      title: "Fast Delivery",
      description: "Images served through Google's CDN for quick loading"
    },
    {
      title: "No VPS Costs",
      description: "Save on server storage and bandwidth costs"
    },
    {
      title: "Version Control",
      description: "Google Drive keeps previous versions of your images"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted z-50">
        <div className="h-full bg-primary w-2/4 transition-all duration-300" />
      </div>

      {/* Progress Indicator */}
      <div className="container max-w-4xl mx-auto pt-8 pb-4 px-4">
        <div className="flex items-center justify-center gap-2 md:gap-4">
          {[1, 2].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                step <= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {step}
              </div>
              {step < 2 && <div className={`w-8 md:w-16 h-0.5 ${step < 2 ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-2">Step 2 of 2</p>
      </div>

      {/* Main Content */}
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="bg-card rounded-lg shadow-lg border p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 mb-4">
              <HardDrive className="w-8 h-8 text-blue-600" />
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold">Connect Google Drive</h1>
              <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                Recommended
              </span>
            </div>
            <p className="text-muted-foreground">Store and manage product images securely in your Google Drive (optional)</p>
          </div>

          {/* Advantages Section */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {advantages.map((advantage, index) => (
              <div key={index} className="flex gap-3 p-4 rounded-lg bg-muted/50 border">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">{advantage.title}</p>
                  <p className="text-xs text-muted-foreground">{advantage.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Connection Status Card */}
          <Card className={`admin-card ${!isDriveConnected ? 'border-amber-500 border-2' : 'border-green-500 border-2'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDriveConnected ? 'bg-green-500/10' : 'bg-blue-500/10'}`}>
                  <HardDrive className={`w-5 h-5 ${isDriveConnected ? 'text-green-600' : 'text-blue-600'}`} />
                </div>
                Connection Status (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`flex items-center justify-between p-4 rounded-lg border ${isDriveConnected ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-border bg-muted/50'}`}>
                <div className="space-y-1">
                  <p className={`font-medium text-sm ${isDriveConnected ? 'text-green-700 dark:text-green-400' : ''}`}>
                    {isVerifying ? "Checking..." : isDriveConnected ? "✓ Connected" : "Not Connected"}
                  </p>
                  <p className={`text-xs ${isDriveConnected ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground'}`}>
                    {isDriveConnected
                      ? "Your Google Drive is ready for image uploads"
                      : "Optional: Connect to enable Google Drive storage, or continue with VPS storage"}
                  </p>
                </div>
                <Button
                  onClick={handleConnectDrive}
                  disabled={isConnectingDrive || isVerifying}
                  variant={isDriveConnected ? "outline" : "default"}
                >
                  {isConnectingDrive ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : isDriveConnected ? (
                    <>
                      <HardDrive className="w-4 h-4 mr-2" />
                      Reconnect
                    </>
                  ) : (
                    <>
                      <HardDrive className="w-4 h-4 mr-2" />
                      Connect Google Drive
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t">
            <Button
              variant="ghost"
              onClick={() => navigate("/onboarding/store-setup")}
              className="order-2 sm:order-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleContinue}
              disabled={isVerifying}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Checking...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleDriveSetup;
