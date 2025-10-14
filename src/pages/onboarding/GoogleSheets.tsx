import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Sheet, CheckCircle2, Loader2, ExternalLink, FileSpreadsheet, Key, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requestSheetsAccess, saveGoogleClientId, getGoogleClientId, initGoogleSignIn } from "@/lib/googleAuth";
import { createStoreSheet } from "@/lib/googleSheetsCreate";
import { saveSpreadsheetId } from "@/lib/googleSheetsSync";

const GoogleSheets = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [setupMethod, setSetupMethod] = useState<"auto" | "manual">("auto");
  const [googleClientId, setGoogleClientId] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [createdSheetUrl, setCreatedSheetUrl] = useState("");
  const [manualSpreadsheetId, setManualSpreadsheetId] = useState("");

  useEffect(() => {
    checkAuthAndLoadStore();
    const savedClientId = getGoogleClientId();
    if (savedClientId) {
      setGoogleClientId(savedClientId);
    }
  }, []);

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

    // Get store info
    const { data: store } = await supabase
      .from("stores")
      .select("name, google_sheet_connected")
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

    if (store.google_sheet_connected) {
      // Already connected, skip to next step
      navigate("/onboarding/customize");
    }
  };

  const handleSaveClientId = () => {
    if (!googleClientId || !googleClientId.includes('.apps.googleusercontent.com')) {
      toast({
        title: "Invalid Client ID",
        description: "Please enter a valid Google Cloud OAuth Client ID",
        variant: "destructive"
      });
      return;
    }

    saveGoogleClientId(googleClientId);
    toast({
      title: "Client ID saved",
      description: "You can now request Google Sheets access"
    });
  };

  const handleRequestAccess = async () => {
    const clientId = getGoogleClientId();
    if (!clientId) {
      toast({
        title: "Client ID required",
        description: "Please enter your Google OAuth Client ID first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      await initGoogleSignIn(clientId);
      await requestSheetsAccess(clientId, true); // Request read/write access
      setHasAccess(true);
      toast({
        title: "Access granted!",
        description: "You can now create Google Sheets"
      });
    } catch (error: any) {
      toast({
        title: "Access denied",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAutoCreate = async () => {
    if (!hasAccess) {
      toast({
        title: "Access required",
        description: "Please grant Google Sheets access first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Creating Google Sheet for store:', storeName);
      const result = await createStoreSheet(storeName);
      
      console.log('Sheet created:', result);
      setCreatedSheetUrl(result.spreadsheetUrl);
      
      // Save to database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      await supabase
        .from("stores")
        .update({
          google_sheet_connected: true,
          last_sheet_sync: new Date().toISOString()
        })
        .eq("user_id", user.id);

      // Save spreadsheet ID locally
      saveSpreadsheetId(result.spreadsheetId);

      toast({
        title: "Sheet created successfully! ✓",
        description: "Your Products and Orders sheets are ready"
      });

    } catch (error: any) {
      console.error('Error creating sheet:', error);
      toast({
        title: "Failed to create sheet",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualConnect = async () => {
    if (!manualSpreadsheetId) {
      toast({
        title: "Spreadsheet ID required",
        description: "Please enter your Google Sheet ID",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      await supabase
        .from("stores")
        .update({
          google_sheet_connected: true,
          last_sheet_sync: new Date().toISOString()
        })
        .eq("user_id", user.id);

      saveSpreadsheetId(manualSpreadsheetId);

      toast({
        title: "Sheet connected!",
        description: "You can now sync products"
      });

      navigate("/onboarding/customize");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (createdSheetUrl || manualSpreadsheetId) {
      navigate("/onboarding/customize");
    }
  };

  const handleSkip = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("stores")
        .update({ google_sheet_connected: false })
        .eq("user_id", user.id);
    }
    navigate("/onboarding/customize");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted z-50">
        <div className="h-full bg-primary w-2/4 transition-all duration-300" />
      </div>

      {/* Progress Indicator */}
      <div className="container max-w-4xl mx-auto pt-8 pb-4 px-4">
        <div className="flex items-center justify-center gap-2 md:gap-4">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                step <= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {step < 2 ? <CheckCircle2 className="w-5 h-5" /> : step}
              </div>
              {step < 4 && <div className={`w-8 md:w-16 h-0.5 ${step < 2 ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-2">Step 2 of 4</p>
      </div>

      {/* Main Content */}
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="bg-card rounded-lg shadow-lg border p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
              <Sheet className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Connect Google Sheets
            </h1>
            <p className="text-muted-foreground">
              Manage your products and orders easily with Google Sheets
            </p>
          </div>

          {/* Setup Instructions */}
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>First time setup required:</strong> You need to create OAuth credentials in Google Cloud Console.
              <a 
                href="https://console.cloud.google.com/apis/credentials" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline ml-1 inline-flex items-center gap-1"
              >
                Open Google Cloud Console <ExternalLink className="w-3 h-3" />
              </a>
            </AlertDescription>
          </Alert>

          {/* Google Client ID Configuration */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Step 1: Configure OAuth Credentials
              </CardTitle>
              <CardDescription>
                Create OAuth 2.0 Client ID in Google Cloud Console and paste it here
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Google OAuth Client ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="clientId"
                    placeholder="xxxxx.apps.googleusercontent.com"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleSaveClientId} variant="outline">
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Required to access Google Sheets API. Create one in Google Cloud Console.
                </p>
              </div>

              {googleClientId && (
                <Button 
                  onClick={handleRequestAccess} 
                  disabled={loading || hasAccess}
                  className="w-full"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Requesting Access...</>
                  ) : hasAccess ? (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> Access Granted</>
                  ) : (
                    "Grant Google Sheets Access"
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Sheet Setup Methods */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Step 2: Setup Your Google Sheet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={setupMethod} onValueChange={(v) => setSetupMethod(v as any)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="auto">Auto Create (Recommended)</TabsTrigger>
                  <TabsTrigger value="manual">Manual Connect</TabsTrigger>
                </TabsList>

                <TabsContent value="auto" className="space-y-4 mt-4">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      We'll automatically create a Google Sheet with Products and Orders tabs, properly formatted and ready to use.
                    </AlertDescription>
                  </Alert>

                  <Button 
                    onClick={handleAutoCreate} 
                    disabled={!hasAccess || loading || !!createdSheetUrl}
                    className="w-full"
                    size="lg"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating Sheet...</>
                    ) : createdSheetUrl ? (
                      <><CheckCircle2 className="w-4 h-4 mr-2" /> Sheet Created</>
                    ) : (
                      "Create Google Sheet Automatically"
                    )}
                  </Button>

                  {!hasAccess && (
                    <p className="text-sm text-muted-foreground text-center">
                      Please grant Google Sheets access first
                    </p>
                  )}

                  {createdSheetUrl && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription>
                        <p className="font-medium text-green-800 mb-2">Sheet created successfully!</p>
                        <a 
                          href={createdSheetUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Open your Google Sheet <ExternalLink className="w-3 h-3" />
                        </a>
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                <TabsContent value="manual" className="space-y-4 mt-4">
                  <Alert>
                    <AlertDescription>
                      If you already have a Google Sheet, enter its ID here. Make sure it has "Products" and "Orders" tabs with the correct column headers.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="spreadsheetId">Google Sheet ID</Label>
                    <Input
                      id="spreadsheetId"
                      placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                      value={manualSpreadsheetId}
                      onChange={(e) => setManualSpreadsheetId(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Find this in your Google Sheet URL after /d/
                    </p>
                  </div>

                  <Button 
                    onClick={handleManualConnect} 
                    disabled={loading || !manualSpreadsheetId}
                    className="w-full"
                    size="lg"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Connecting...</>
                    ) : (
                      "Connect Sheet"
                    )}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t">
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="order-2 sm:order-1"
            >
              Skip for now
            </Button>
            <Button
              onClick={handleContinue}
              disabled={!createdSheetUrl && !manualSpreadsheetId}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleSheets;
