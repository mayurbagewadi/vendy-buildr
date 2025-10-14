import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Sheet, ArrowLeft, ExternalLink, Copy, Share, Link2, CheckCircle, XCircle, Loader2, FileText, HelpCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const GoogleSheets = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");
  
  const [formData, setFormData] = useState({
    sheetsUrl: "",
    webAppUrl: ""
  });

  const TEMPLATE_URL = "https://docs.google.com/spreadsheets/d/1example/copy";

  const testConnection = async () => {
    if (!formData.sheetsUrl) return;

    setTesting(true);
    setConnectionStatus("idle");

    // Simulate API test
    setTimeout(() => {
      const isValid = formData.sheetsUrl.includes("docs.google.com/spreadsheets");
      setConnectionStatus(isValid ? "success" : "error");
      setTesting(false);
      
      if (isValid) {
        toast({
          title: "Connection successful!",
          description: "Your Google Sheet is connected."
        });
      } else {
        toast({
          title: "Connection failed",
          description: "Please check your URL and try again.",
          variant: "destructive"
        });
      }
    }, 1500);
  };

  const handleContinue = async () => {
    if (connectionStatus !== "success") return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase
        .from("stores")
        .update({
          google_sheet_connected: true,
          last_sheet_sync: new Date().toISOString()
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Sheet connected!",
        description: "Let's customize your store appearance."
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
                {step}
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
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Connect Your Product Sheet</h1>
            <p className="text-muted-foreground">We use Google Sheets to manage your products - it's simple!</p>
          </div>

          {/* Why Google Sheets */}
          <div className="bg-accent/50 rounded-lg p-6 mb-8">
            <h3 className="font-semibold mb-4">Why Google Sheets?</h3>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>Familiar spreadsheet interface</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>Manage products easily</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>Real-time sync with your store</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>No learning curve</span>
              </div>
            </div>
          </div>

          {/* Quick Setup Steps */}
          <div className="mb-8">
            <h3 className="font-semibold mb-4">Quick Setup (3 Easy Steps)</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {/* Card 1 */}
              <div className="bg-card border rounded-lg p-4 space-y-3">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <Copy className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-medium">Copy Template</h4>
                <p className="text-sm text-muted-foreground">Use our pre-built template with sample products</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => window.open(TEMPLATE_URL, "_blank")}
                >
                  <FileText className="w-4 h-4" />
                  Copy Template
                </Button>
              </div>

              {/* Card 2 */}
              <div className="bg-card border rounded-lg p-4 space-y-3">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <Share className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-medium">Share Your Sheet</h4>
                <p className="text-sm text-muted-foreground">Make sure "Anyone with link can view"</p>
                <div className="text-xs text-muted-foreground pt-2">
                  Get the sharing link from your sheet
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-card border rounded-lg p-4 space-y-3">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <Link2 className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-medium">Connect Here</h4>
                <p className="text-sm text-muted-foreground">Paste the URL and test connection</p>
                <div className="text-xs text-muted-foreground pt-2">
                  We'll verify the connection
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Google Sheets URL */}
            <div className="space-y-2">
              <Label htmlFor="sheetsUrl">
                Google Sheets URL <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="sheetsUrl"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={formData.sheetsUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, sheetsUrl: e.target.value }))}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={testConnection}
                  disabled={!formData.sheetsUrl || testing}
                >
                  {testing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Test"
                  )}
                </Button>
              </div>
              
              {connectionStatus === "idle" && (
                <p className="text-xs text-muted-foreground">Not tested</p>
              )}
              {connectionStatus === "success" && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Connected
                </p>
              )}
              {connectionStatus === "error" && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Connection failed - check URL
                </p>
              )}
            </div>

            {/* Web App URL */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="webAppUrl">Web App URL</Label>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <HelpCircle className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>How to get Web App URL</DialogTitle>
                      <DialogDescription className="space-y-2 pt-4">
                        <p>1. Open your Google Sheet</p>
                        <p>2. Go to Extensions → Apps Script</p>
                        <p>3. Deploy as Web App</p>
                        <p>4. Copy the deployment URL</p>
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
              </div>
              <Input
                id="webAppUrl"
                placeholder="https://script.google.com/macros/s/..."
                value={formData.webAppUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, webAppUrl: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Optional for now (can add later)</p>
            </div>
          </div>

          {/* Help Section */}
          <Accordion type="single" collapsible className="mt-6">
            <AccordionItem value="help">
              <AccordionTrigger className="text-sm font-medium">
                Need Help?
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div>
                  <h4 className="font-medium mb-2">Video Tutorial</h4>
                  <div className="bg-muted rounded aspect-video flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">2-minute setup guide</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">FAQ</h4>
                  <div className="text-sm space-y-2 text-muted-foreground">
                    <p>• Make sure your sheet is shared with "Anyone with link can view"</p>
                    <p>• The URL should start with https://docs.google.com/spreadsheets/</p>
                    <p>• You can update this connection anytime from settings</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  Contact Support
                </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t">
            <Button
              variant="ghost"
              onClick={() => navigate("/onboarding/store-setup")}
              className="order-2 sm:order-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex gap-2 order-1 sm:order-2 w-full sm:w-auto">
              <Button
                variant="ghost"
                onClick={() => navigate("/onboarding/customize")}
              >
                Setup Later
              </Button>
              <Button
                onClick={handleContinue}
                disabled={connectionStatus !== "success" || loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleSheets;
