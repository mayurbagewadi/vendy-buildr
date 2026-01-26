import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Store, Check, X, Loader2, XCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { seedDemoDataForStore } from "@/lib/seedDemoData";
import { GoogleDriveConnectionBlock } from "@/components/GoogleDriveConnectionBlock";

const StoreSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [userName, setUserName] = useState("");
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockErrorMessage, setBlockErrorMessage] = useState("");

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

    // Restore form data from sessionStorage if available (after OAuth redirect)
    const savedFormData = sessionStorage.getItem('storeSetupFormData');
    if (savedFormData) {
      try {
        const parsedData = JSON.parse(savedFormData);
        setFormData(parsedData);
        sessionStorage.removeItem('storeSetupFormData');
      } catch (error) {
        console.error('Error restoring form data:', error);
      }
    }
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

    // Check if user is already a helper
    const { data: existingHelper } = await supabase
      .from("helpers")
      .select("id, full_name, status")
      .eq("id", user.id)
      .maybeSingle();

    if (existingHelper) {
      setBlockErrorMessage("You are registered as a helper. Helpers cannot create stores. Please contact support if you need assistance.");
      setBlockModalOpen(true);
      setTimeout(() => navigate("/helper/dashboard"), 3000);
      return;
    }

    // Check if user has applied as a helper
    const { data: helperApplication } = await supabase
      .from("helper_applications")
      .select("id, application_status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (helperApplication) {
      setBlockErrorMessage("You have applied or are registered as a helper. Helpers cannot create stores.");
      setBlockModalOpen(true);
      setTimeout(() => navigate("/application-status"), 3000);
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
      .replace(/[^a-z0-9]/g, "")
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

      // Get Google Drive tokens from session
      const { data: { session } } = await supabase.auth.getSession();
      const providerToken = session?.provider_token;
      const providerRefreshToken = session?.provider_refresh_token;
      const tokenExpiry = providerToken ? new Date(Date.now() + 3600 * 1000).toISOString() : null;

      const { data: storeData, error } = await supabase.from("stores").insert({
        user_id: user.id,
        name: formData.storeName,
        slug: formData.storeSlug,
        subdomain: formData.storeSlug,
        description: formData.description || null,
        whatsapp_number: `${formData.countryCode}${formData.whatsappNumber}`,
        google_access_token: providerToken || null,
        google_refresh_token: providerRefreshToken || null,
        google_token_expiry: tokenExpiry,
      }).select();

      if (error) throw error;

      // Get the new store ID (needed for both demo data and referral tracking)
      const newStoreId = storeData && storeData.length > 0 ? storeData[0].id : null;

      // Seed demo products and categories for the new store
      if (newStoreId) {
        await seedDemoDataForStore(newStoreId);
      }

      // Check for referral code and create store_referrals record
      const referralCode = sessionStorage.getItem('referral_code');
      if (referralCode && newStoreId) {
        console.log('[StoreSetup] Processing referral code:', referralCode);

        // Find the helper by referral code
        const { data: helper } = await supabase
          .from('helpers')
          .select('id')
          .eq('referral_code', referralCode)
          .eq('status', 'Active')
          .maybeSingle();

        if (helper) {
          // Get user profile for store owner info
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email, phone')
            .eq('user_id', user.id)
            .maybeSingle();

          // Create store_referrals record
          const trialEndDate = new Date();
          trialEndDate.setDate(trialEndDate.getDate() + 14); // 14-day trial

          const { error: referralError } = await supabase
            .from('store_referrals')
            .insert({
              helper_id: helper.id,
              store_id: newStoreId, // FIX: Link referral to the created store
              store_owner_name: profile?.full_name || formData.storeName,
              store_owner_email: profile?.email || user.email || '',
              store_owner_phone: formData.whatsappNumber,
              trial_start_date: new Date().toISOString().split('T')[0],
              trial_end_date: trialEndDate.toISOString().split('T')[0],
              trial_status: 'Active',
              subscription_purchased: false,
              commission_status: 'Not Applicable'
            });

          if (referralError) {
            console.error('[StoreSetup] Error creating referral record:', referralError);
          } else {
            console.log('[StoreSetup] Referral record created successfully');
          }

          // Clear the referral code from sessionStorage
          sessionStorage.removeItem('referral_code');
        } else {
          console.log('[StoreSetup] No active helper found for referral code:', referralCode);
        }
      }

      // Auto-assign default subscription plan
      const { data: defaultPlan } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_default_plan", true)
        .maybeSingle();

      if (defaultPlan) {
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + (defaultPlan.trial_days || 14));

        await supabase.from("subscriptions").insert({
          user_id: user.id,
          plan_id: defaultPlan.id,
          status: "trial",
          trial_ends_at: trialEndDate.toISOString(),
          current_period_start: new Date().toISOString(),
          current_period_end: trialEndDate.toISOString()
        });
      }

      toast({
        title: "Store created!",
        description: "Your store is ready with demo products."
      });

      navigate("/admin/dashboard");
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

            {/* Store Domain */}
            <div className="space-y-2">
              <Label htmlFor="storeSlug">
                Store Domain <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    id="storeSlug"
                    value={formData.storeSlug}
                    readOnly
                    disabled
                    maxLength={30}
                    className="pr-8 bg-muted cursor-not-allowed"
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
                <p>• Lowercase letters and numbers only</p>
                <p>• Must start with letter</p>
                <p>• Auto-generated from store name</p>
              </div>
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

          {/* Google Drive Connection */}
          <div className="mt-8">
            <GoogleDriveConnectionBlock variant="compact" showDescription={false} formData={formData} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-4 mt-8 pt-6 border-t">
            <Button
              onClick={handleContinue}
              disabled={!isValidForm() || loading}
              className="w-full sm:w-auto"
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

      {/* Blocking Error Modal */}
      <Dialog open={blockModalOpen} onOpenChange={setBlockModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-red-100 p-3">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl font-bold text-red-600">
              Access Blocked
            </DialogTitle>
            <DialogDescription className="text-center text-base pt-4">
              {blockErrorMessage}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button
              onClick={() => setBlockModalOpen(false)}
              className="w-full sm:w-auto"
              variant="default"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoreSetup;
