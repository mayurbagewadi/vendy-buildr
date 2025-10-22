import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Palette, ArrowLeft, Loader2, Upload, RotateCcw } from "lucide-react";

const Customize = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [storeData, setStoreData] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    logoUrl: "",
    heroBannerUrl: "",
    tagline: "",
    primaryColor: "#3B82F6",
    secondaryColor: "#10B981"
  });

  useEffect(() => {
    loadStoreData();
  }, []);

  const loadStoreData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("stores")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data) setStoreData(data);
    }
  };

  const resetToDefaults = () => {
    setFormData(prev => ({
      ...prev,
      primaryColor: "#3B82F6",
      secondaryColor: "#10B981"
    }));
  };

  const handleContinue = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase
        .from("stores")
        .update({
          logo_url: formData.logoUrl || null,
          hero_banner_url: formData.heroBannerUrl || null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Store customized!",
        description: "Let's complete your setup."
      });

      navigate("/onboarding/complete");
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
        <div className="h-full bg-primary w-3/4 transition-all duration-300" />
      </div>

      {/* Progress Indicator */}
      <div className="container max-w-4xl mx-auto pt-8 pb-4 px-4">
        <div className="flex items-center justify-center gap-2 md:gap-4">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                step <= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {step}
              </div>
              {step < 4 && <div className={`w-8 md:w-16 h-0.5 ${step < 3 ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-2">Step 3 of 4</p>
      </div>

      {/* Main Content */}
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="bg-card rounded-lg shadow-lg border overflow-hidden">
          {/* Header */}
          <div className="text-center p-6 md:p-8 border-b">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 mb-4">
              <Palette className="w-8 h-8 text-purple-600" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Make It Yours</h1>
            <p className="text-muted-foreground">Customize your store's look and feel</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 p-6 md:p-8">
            {/* Left Side - Form */}
            <div className="space-y-6">
              {/* Store Logo */}
              <div className="space-y-3">
                <Label>Store Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted">
                    {formData.logoUrl ? (
                      <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Paste Google Drive link or image URL"
                      value={formData.logoUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, logoUrl: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">Recommended size: 200x200px</p>
                  </div>
                </div>
              </div>

              {/* Hero Banner */}
              <div className="space-y-3">
                <Label>Hero Banner Image</Label>
                <div className="space-y-2">
                  <div className="w-full aspect-video rounded-lg border-2 border-dashed flex items-center justify-center bg-muted overflow-hidden">
                    {formData.heroBannerUrl ? (
                      <img src={formData.heroBannerUrl} alt="Banner" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <Input
                    placeholder="Paste Google Drive link or image URL"
                    value={formData.heroBannerUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, heroBannerUrl: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Recommended size: 1920x600px • This appears on your store homepage
                  </p>
                </div>
              </div>

              {/* Store Tagline */}
              <div className="space-y-2">
                <Label htmlFor="tagline">Store Tagline</Label>
                <Input
                  id="tagline"
                  placeholder="Quality products, fast delivery"
                  value={formData.tagline}
                  onChange={(e) => setFormData(prev => ({ ...prev, tagline: e.target.value.substring(0, 100) }))}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground text-right">{formData.tagline.length}/100</p>
              </div>

              {/* Color Scheme */}
              <div className="space-y-4">
                <Label>Color Scheme</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Primary Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-12 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={formData.primaryColor}
                        onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Buttons, links, headers</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Secondary Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.secondaryColor}
                        onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        className="w-12 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={formData.secondaryColor}
                        onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Accents, success messages</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={resetToDefaults} className="w-full">
                  <RotateCcw className="w-4 h-4" />
                  Reset to Defaults
                </Button>
              </div>

              {/* Branding */}
              <div className="bg-accent/50 rounded-lg p-4">
                <Label className="mb-2 block">Branding</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  "Powered by YourPlatform" will appear on your store
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Upgrade to Remove Branding
                </Button>
              </div>
            </div>

            {/* Right Side - Preview */}
            <div className="bg-muted/30 rounded-lg p-6 lg:sticky lg:top-24 lg:self-start">
              <p className="text-sm font-medium mb-4 text-center">Live Preview</p>
              <div className="bg-background rounded-lg shadow-lg overflow-hidden border">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                  <div className="flex items-center gap-2">
                    {formData.logoUrl ? (
                      <img src={formData.logoUrl} alt="Logo" className="w-8 h-8 object-cover rounded" />
                    ) : (
                      <div className="w-8 h-8 bg-muted rounded" />
                    )}
                    <span className="font-semibold text-sm">{storeData?.name || "Your Store"}</span>
                  </div>
                </div>

                {/* Hero Banner */}
                <div className="relative aspect-[2/1] bg-gradient-to-br from-primary/20 to-secondary/20 overflow-hidden">
                  {formData.heroBannerUrl ? (
                    <img src={formData.heroBannerUrl} alt="Hero" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full" />
                  )}
                  {formData.tagline && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-white font-bold text-lg md:text-xl text-center px-4 bg-black/30 py-2 rounded">
                        {formData.tagline}
                      </p>
                    </div>
                  )}
                </div>

                {/* Sample Products */}
                <div className="p-4 space-y-3">
                  <p className="text-xs font-semibold">Products</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="border rounded-lg overflow-hidden">
                        <div className="aspect-square bg-muted" />
                        <div className="p-2 space-y-1">
                          <div className="h-3 bg-muted rounded w-3/4" />
                          <div
                            className="h-4 rounded w-1/2"
                            style={{ backgroundColor: formData.primaryColor + "40" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="w-full py-2 rounded text-sm font-medium text-white"
                    style={{ backgroundColor: formData.primaryColor }}
                  >
                    View All
                  </button>
                </div>

                {/* Footer */}
                <div className="p-4 border-t text-center">
                  <p className="text-xs text-muted-foreground">Powered by YourPlatform</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 md:p-8 border-t">
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
                onClick={() => navigate("/onboarding/complete")}
              >
                Skip for Now
              </Button>
              <Button onClick={handleContinue} disabled={loading}>
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

export default Customize;
