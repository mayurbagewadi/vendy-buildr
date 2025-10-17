import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sheet, CheckCircle2, Loader2, ExternalLink, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const GoogleSheets = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [sheetCreated, setSheetCreated] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [step, setStep] = useState<'connect' | 'creating' | 'done'>('connect');

  useEffect(() => {
    checkAuthAndLoadStore();
    loadGoogleScript();
  }, []);

  const loadGoogleScript = () => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  };

  const checkAuthAndLoadStore = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to continue",
        variant: "destructive"
      });
      navigate("/auth");
      return;
    }

    const { data: store } = await supabase
      .from("stores")
      .select("name, google_sheet_connected, google_sheet_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!store) {
      toast({
        title: "Store not found",
        description: "Please complete store setup first",
        variant: "destructive"
      });
      navigate("/onboarding/store-setup");
      return;
    }

    setStoreName(store.name);

    if (store.google_sheet_connected && store.google_sheet_url) {
      setSheetCreated(true);
      setSheetUrl(store.google_sheet_url);
      setStep('done');
    }
  };

  const handleConnectGoogleSheets = async () => {
    setLoading(true);
    setStep('creating');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Initialize Google OAuth client
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
        ux_mode: 'popup',
        callback: async (response: any) => {
          if (response.code) {
            await handleOAuthCallback(response.code, user.id);
          } else {
            throw new Error('Failed to get authorization code');
          }
        },
      });

      client.requestCode();
    } catch (error: any) {
      console.error('OAuth error:', error);
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect to Google Sheets",
        variant: "destructive",
      });
      setLoading(false);
      setStep('connect');
    }
  };

  const handleOAuthCallback = async (code: string, userId: string) => {
    try {
      console.log('Starting OAuth callback with code and userId');
      
      // Exchange code for tokens
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('google-oauth-callback', {
        body: { code, userId }
      });

      console.log('Token exchange response:', { tokenData, tokenError });

      if (tokenError) {
        console.error('Token error:', tokenError);
        throw new Error(tokenError.message || 'Failed to exchange OAuth code');
      }
      
      if (!tokenData || tokenData.error) {
        throw new Error(tokenData?.error || 'Failed to exchange OAuth code');
      }

      console.log('Starting sheet creation for store:', storeName);

      // Create Google Sheet automatically
      const { data: sheetData, error: sheetError } = await supabase.functions.invoke('create-google-sheet', {
        body: { userId, storeName }
      });

      console.log('Sheet creation response:', { sheetData, sheetError });

      if (sheetError) {
        console.error('Sheet error:', sheetError);
        throw new Error(sheetError.message || 'Failed to create Google Sheet');
      }
      
      if (!sheetData || sheetData.error) {
        throw new Error(sheetData?.error || 'Failed to create Google Sheet');
      }

      console.log('Sheet created successfully:', sheetData.spreadsheetUrl);

      setSheetUrl(sheetData.spreadsheetUrl);
      setSheetCreated(true);
      setStep('done');

      toast({
        title: "Success!",
        description: "Google Sheets connected and your product sheet is ready",
      });
    } catch (error: any) {
      console.error('Callback error:', error);
      toast({
        title: "Setup failed",
        description: error.message || "Failed to complete Google Sheets setup",
        variant: "destructive",
      });
      setStep('connect');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    navigate("/onboarding/customize");
  };

  const handleSkip = () => {
    navigate("/onboarding/customize");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
              ✓
            </div>
            <span className="text-sm font-medium">Store Setup</span>
          </div>
          <div className="w-12 h-0.5 bg-primary" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
              2
            </div>
            <span className="text-sm font-medium text-primary">Google Sheets</span>
          </div>
          <div className="w-12 h-0.5 bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-semibold">
              3
            </div>
            <span className="text-sm text-muted-foreground">Customize</span>
          </div>
        </div>

        {/* Main Card */}
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Sheet className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Connect Google Sheets</CardTitle>
            <CardDescription>
              Automatically manage your products and orders with Google Sheets integration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 'connect' && (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    We'll create a Google Sheet for you with "Products" and "Orders" tabs, set up with proper formatting and headers.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg space-y-3">
                    <h3 className="font-semibold text-sm">What you'll get:</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Automatic Google Sheet creation with Products and Orders tabs</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Two-way sync: Update products in admin panel or directly in Google Sheets</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Automatic order logging when customers place orders</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>View today's orders, filter by status, and manage from admin panel</span>
                      </li>
                    </ul>
                  </div>

                  <Button 
                    onClick={handleConnectGoogleSheets}
                    disabled={loading}
                    size="lg"
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Sheet className="w-4 h-4 mr-2" />
                        Connect Google Sheets
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {step === 'creating' && (
              <div className="text-center py-8 space-y-4">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
                <div>
                  <p className="font-semibold">Creating your Google Sheet...</p>
                  <p className="text-sm text-muted-foreground">This will only take a moment</p>
                </div>
              </div>
            )}

            {step === 'done' && sheetCreated && (
              <>
                <Alert className="border-green-600 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Your Google Sheet is ready! You can now manage products and view orders.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg space-y-3">
                    <h3 className="font-semibold text-sm">Next steps:</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="font-semibold text-primary">1.</span>
                        <span>Go to Admin → Products to add your first product</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-semibold text-primary">2.</span>
                        <span>Click "Open Product Sheet" to view your Google Sheet</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-semibold text-primary">3.</span>
                        <span>Check Admin → Orders to track customer orders</span>
                      </li>
                    </ul>
                  </div>

                  {sheetUrl && (
                    <Button 
                      variant="outline" 
                      onClick={() => window.open(sheetUrl, '_blank')}
                      className="w-full"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Your Google Sheet
                    </Button>
                  )}

                  <Button onClick={handleContinue} size="lg" className="w-full">
                    Continue to Customization
                  </Button>
                </div>
              </>
            )}

            <div className="flex justify-between items-center pt-4 border-t">
              <Button 
                variant="ghost" 
                onClick={handleSkip}
                disabled={loading}
              >
                Skip for now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GoogleSheets;
