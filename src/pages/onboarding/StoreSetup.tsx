import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Store, Check, X, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const StoreSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [userName, setUserName] = useState("");
  
  const [formData, setFormData] = useState({
    storeName: "",
    storeSlug: "",
    description: "",
    whatsappNumber: "",
    countryCode: "+91"
  });
  
  const [slugStatus, setSlugStatus] = useState<"idle" | "available" | "taken">("idle");

  useEffect(() => {
    checkAuthAndLoadData();
  }, [navigate]);

  const checkAuthAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to continue with onboarding",
        variant: "destructive"
      });
      navigate("/auth");
      return;
    }
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    
    setUserName(profile?.full_name || user.email || "Guest");
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 30);
  };

  const handleStoreNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      storeName: value,
      storeSlug: generateSlug(value)
    }));
    if (value) checkSlugAvailability(generateSlug(value));
  };

  const handleSlugChange = (value: string) => {
    const slug = generateSlug(value);
    setFormData(prev => ({ ...prev, storeSlug: slug }));
    if (slug) checkSlugAvailability(slug);
  };

  const checkSlugAvailability = async (slug: string) => {
    if (slug.length < 3) {
      setSlugStatus("idle");
      return;
    }
    
    setCheckingSlug(true);
    const { data } = await supabase
      .from("stores")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    
    setSlugStatus(data ? "taken" : "available");
    setCheckingSlug(false);
  };

  const isValidForm = () => {
    return (
      formData.storeName.length >= 2 &&
      formData.storeName.length <= 50 &&
      formData.storeSlug.length >= 3 &&
      formData.storeSlug.length <= 30 &&
      slugStatus === "available" &&
      formData.whatsappNumber.length >= 10
    );
  };

  const handleContinue = async () => {
    if (!isValidForm()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase.from("stores").insert({
        user_id: user.id,
        name: formData.storeName,
        slug: formData.storeSlug,
        description: formData.description || null,
        whatsapp_number: `${formData.countryCode}${formData.whatsappNumber}`
      });

      if (error) throw error;

      toast({
        title: "Store created!",
        description: "Let's connect your product sheet next."
      });

      navigate("/onboarding/google-sheets");
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
        <div className="h-full bg-primary w-1/4 transition-all duration-300" />
      </div>

      {/* Progress Indicator */}
      <div className="container max-w-4xl mx-auto pt-8 pb-4 px-4">
        <div className="flex items-center justify-center gap-2 md:gap-4">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {step}
              </div>
              {step < 4 && <div className={`w-8 md:w-16 h-0.5 ${step < 1 ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-2">Step 1 of 4</p>
      </div>

      {/* Main Content */}
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <div className="bg-card rounded-lg shadow-lg border p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Store className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Welcome, {userName}! 👋
            </h1>
            <p className="text-muted-foreground">Let's set up your online store</p>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Store Name */}
            <div className="space-y-2">
              <Label htmlFor="storeName">
                Store Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="storeName"
                placeholder="My Awesome Store"
                value={formData.storeName}
                onChange={(e) => handleStoreNameChange(e.target.value)}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                This will be displayed to your customers
              </p>
            </div>

            {/* Store Slug */}
            <div className="space-y-2">
              <Label htmlFor="storeSlug">
                Store Slug <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap hidden md:inline">
                  yourplatform.com/
                </span>
                <div className="flex-1 relative">
                  <Input
                    id="storeSlug"
                    value={formData.storeSlug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    maxLength={30}
                    className="pr-8"
                  />
                  {checkingSlug && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                  {!checkingSlug && slugStatus === "available" && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                  )}
                  {!checkingSlug && slugStatus === "taken" && (
                    <X className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-destructive" />
                  )}
                </div>
              </div>
              
              {slugStatus === "available" && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Available
                </p>
              )}
              {slugStatus === "taken" && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <X className="w-3 h-3" /> Already taken
                </p>
              )}
              
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• 3-30 characters</p>
                <p>• Lowercase letters, numbers, hyphens only</p>
                <p>• Must start with letter</p>
              </div>
              
              {formData.storeSlug && (
                <p className="text-xs text-primary font-medium">
                  Your store will be: {formData.storeSlug}.yourplatform.com
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Store Description</Label>
              <Textarea
                id="description"
                placeholder="Tell customers about your store..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                maxLength={500}
                rows={4}
              />
              <p className="text-xs text-muted-foreground text-right">
                {formData.description.length}/500
              </p>
            </div>

            {/* WhatsApp Number */}
            <div className="space-y-2">
              <Label htmlFor="whatsapp">
                WhatsApp Business Number <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Select value={formData.countryCode} onValueChange={(value) => setFormData(prev => ({ ...prev, countryCode: value }))}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="+91">🇮🇳 +91</SelectItem>
                    <SelectItem value="+1">🇺🇸 +1</SelectItem>
                    <SelectItem value="+44">🇬🇧 +44</SelectItem>
                    <SelectItem value="+971">🇦🇪 +971</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="whatsapp"
                  type="tel"
                  placeholder="9876543210"
                  value={formData.whatsappNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsappNumber: e.target.value.replace(/\D/g, "") }))}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Customers will place orders via WhatsApp to this number
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t">
            <Button
              variant="ghost"
              onClick={() => navigate("/admin/dashboard")}
              className="order-2 sm:order-1"
            >
              I'll do this later
            </Button>
            <Button
              onClick={handleContinue}
              disabled={!isValidForm() || loading}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
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

export default StoreSetup;
