import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  Globe,
  Phone,
  Mail,
  MapPin,
  Clock,
  Loader2,
  Save,
  Info,
  Sparkles,
  Eye,
  RefreshCw,
  Zap,
  CheckCircle,
  XCircle
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SEOSettings {
  alternate_names: string;
  seo_description: string;
  business_phone: string;
  business_email: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  opening_hours: string;
  price_range: string;
}

const SEOSettingsPage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [isSubmittingSitemap, setIsSubmittingSitemap] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [sitemapResult, setSitemapResult] = useState<any>(null);
  const [indexingResult, setIndexingResult] = useState<any>(null);

  const [settings, setSettings] = useState<SEOSettings>({
    alternate_names: "",
    seo_description: "",
    business_phone: "",
    business_email: "",
    street_address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "IN",
    opening_hours: "",
    price_range: "₹₹",
  });

  useEffect(() => {
    loadStoreData();
  }, []);

  /**
   * Enterprise Pattern: Auto-fill with Fallback Chain
   * Priority: SEO-specific field → Settings field → Default
   * This ensures data entered in Settings is reused, reducing duplicate entry
   */
  const loadStoreData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Fetch store data
      const { data: store, error } = await supabase
        .from("stores")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (error || !store) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load store data",
        });
        return;
      }

      // Fetch profile data for auto-fill (phone, email from Settings)
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone, email")
        .eq("user_id", session.user.id)
        .single();

      setStoreId(store.id);
      setStoreName(store.name || "");
      setStoreSlug(store.slug || "");

      /**
       * Auto-fill Logic (Fallback Chain):
       * 1. First check if SEO-specific field has value (already saved)
       * 2. If empty, fall back to corresponding Settings field
       * 3. If still empty, use default
       *
       * This way:
       * - Existing SEO data is preserved
       * - New users get auto-filled data from Settings
       * - Store owner can still override if needed
       */
      setSettings({
        // SEO-only fields (no fallback needed)
        alternate_names: store.alternate_names || "",
        price_range: store.price_range || "₹₹",
        opening_hours: store.opening_hours || "",
        city: store.city || "",
        state: store.state || "",
        postal_code: store.postal_code || "",
        country: store.country || "IN",

        // Auto-fill: SEO description ← Store description (from Settings)
        seo_description: store.seo_description || store.description || "",

        // Auto-fill: Business phone ← Profile phone ← WhatsApp number (from Settings/Onboarding)
        business_phone: store.business_phone || profile?.phone || store.whatsapp_number || "",

        // Auto-fill: Business email ← Profile email (from Google Auth / Settings)
        business_email: store.business_email || profile?.email || "",

        // Auto-fill: Street address ← Store address (from Settings)
        street_address: store.street_address || store.address || "",
      });
    } catch (error) {
      console.error("Error loading store data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!storeId) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({
          alternate_names: settings.alternate_names,
          seo_description: settings.seo_description,
          business_phone: settings.business_phone,
          business_email: settings.business_email,
          street_address: settings.street_address,
          city: settings.city,
          state: settings.state,
          postal_code: settings.postal_code,
          country: settings.country,
          opening_hours: settings.opening_hours,
          price_range: settings.price_range,
        })
        .eq("id", storeId);

      if (error) throw error;

      toast({
        title: "SEO Settings Saved",
        description: "Your SEO settings have been updated successfully. Changes may take a few days to reflect in search results.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save SEO settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const generateAlternateNames = () => {
    if (!storeName) return;

    // Generate variations automatically
    const name = storeName;
    const variations: string[] = [];

    // Add space between camelCase
    const withSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2');
    if (withSpaces !== name) variations.push(withSpaces);

    // Remove spaces
    const noSpaces = name.replace(/\s+/g, '');
    if (noSpaces !== name) variations.push(noSpaces);

    // Common misspellings - double vowels
    const doubleVowel = name.replace(/a/gi, 'aa').replace(/e/gi, 'ee');
    if (doubleVowel !== name && !variations.includes(doubleVowel)) {
      variations.push(withSpaces.replace(/a/gi, 'aa'));
    }

    const uniqueVariations = [...new Set(variations)].filter(v => v !== name);
    setSettings(prev => ({
      ...prev,
      alternate_names: uniqueVariations.join(", ")
    }));

    toast({
      title: "Variations Generated",
      description: `Generated ${uniqueVariations.length} name variations`,
    });
  };

  const submitSitemap = async () => {
    if (!storeId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Store ID not found. Please refresh the page.",
      });
      return;
    }

    try {
      setIsSubmittingSitemap(true);
      setSitemapResult(null);

      toast({
        title: "Submitting Sitemap",
        description: "Submitting your sitemap to Google Search Console...",
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please login again.');
      }

      const response = await fetch('https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/submit-sitemap-to-google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ storeId }),
      });

      const data = await response.json();

      if (data.success) {
        setSitemapResult(data.results?.[0] || { success: true });
        toast({
          title: "Sitemap Submitted!",
          description: "Your sitemap has been submitted to Google. It may take a few days to appear in search results.",
        });
      } else {
        throw new Error(data.error || 'Failed to submit sitemap');
      }
    } catch (error: any) {
      console.error('Error submitting sitemap:', error);
      setSitemapResult({ success: false, error: error.message });
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.message || "Failed to submit sitemap to Google",
      });
    } finally {
      setIsSubmittingSitemap(false);
    }
  };

  const requestIndexing = async () => {
    if (!storeId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Store ID not found. Please refresh the page.",
      });
      return;
    }

    try {
      setIsIndexing(true);
      setIndexingResult(null);

      toast({
        title: "Requesting Indexing",
        description: "Requesting immediate indexing from Google. This is faster than sitemap submission.",
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please login again.');
      }

      const response = await fetch('https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/index-urls-to-google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ storeId }),
      });

      const data = await response.json();

      if (data.success) {
        setIndexingResult(data.results?.[0] || { success: true });
        toast({
          title: "Indexing Requested!",
          description: `Successfully requested indexing. Your store should appear in Google within hours.`,
        });
      } else {
        throw new Error(data.error || 'Failed to request indexing');
      }
    } catch (error: any) {
      console.error('Error requesting indexing:', error);
      setIndexingResult({ success: false, error: error.message });
      toast({
        variant: "destructive",
        title: "Indexing Failed",
        description: error.message || "Failed to request indexing from Google",
      });
    } finally {
      setIsIndexing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Search className="w-6 h-6" />
                SEO Settings
              </h1>
              <p className="text-muted-foreground mt-1">
                Optimize your store for search engines like Google
              </p>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>

          {/* Info Banner */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-start gap-3 pt-4">
              <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">How SEO helps your store</p>
                <p className="text-muted-foreground mt-1">
                  These settings help Google understand your business better. When someone searches for "{storeName}" or similar terms,
                  Google will show rich information about your store including address, phone, and hours.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Basic SEO */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Basic Information
                </CardTitle>
                <CardDescription>
                  Help customers find your store with different search terms
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="storeName">Store Name</Label>
                  <Input
                    id="storeName"
                    value={storeName}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Change this in Settings → Store Details
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="alternateNames" className="flex items-center gap-2">
                      Also Known As
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3.5 h-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Add variations of your store name that customers might search for. Separate with commas.</p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={generateAlternateNames}
                      className="h-7 text-xs"
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Auto Generate
                    </Button>
                  </div>
                  <Input
                    id="alternateNames"
                    placeholder="Sasu Masale, Sasu Masaale, SasuMasaale"
                    value={settings.alternate_names}
                    onChange={(e) => setSettings(prev => ({ ...prev, alternate_names: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: If store is "SasuMasale", add "Sasu Masale, Sasu Masaale"
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seoDescription">
                    SEO Description
                    <Badge variant="secondary" className="ml-2 text-xs">Important</Badge>
                  </Label>
                  <Textarea
                    id="seoDescription"
                    placeholder="Fresh Indian spices store offering premium quality masale. Buy garam masala, turmeric, and more..."
                    value={settings.seo_description}
                    onChange={(e) => setSettings(prev => ({ ...prev, seo_description: e.target.value }))}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    {settings.seo_description.length}/160 characters (recommended)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priceRange">Price Range</Label>
                  <select
                    id="priceRange"
                    value={settings.price_range}
                    onChange={(e) => setSettings(prev => ({ ...prev, price_range: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="₹">₹ - Budget Friendly</option>
                    <option value="₹₹">₹₹ - Moderate</option>
                    <option value="₹₹₹">₹₹₹ - Premium</option>
                    <option value="₹₹₹₹">₹₹₹₹ - Luxury</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  Contact Information
                </CardTitle>
                <CardDescription>
                  Help customers reach you directly from Google search
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessPhone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Business Phone
                  </Label>
                  <Input
                    id="businessPhone"
                    placeholder="+91-9876543210"
                    value={settings.business_phone}
                    onChange={(e) => setSettings(prev => ({ ...prev, business_phone: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessEmail" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Business Email
                  </Label>
                  <Input
                    id="businessEmail"
                    type="email"
                    placeholder="contact@yourstore.com"
                    value={settings.business_email}
                    onChange={(e) => setSettings(prev => ({ ...prev, business_email: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="openingHours" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Opening Hours
                  </Label>
                  <Input
                    id="openingHours"
                    placeholder="Mon-Sat: 9AM-9PM, Sun: 10AM-6PM"
                    value={settings.opening_hours}
                    onChange={(e) => setSettings(prev => ({ ...prev, opening_hours: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Business Address
                </CardTitle>
                <CardDescription>
                  Appears on Google Maps and local search results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="streetAddress">Street Address</Label>
                  <Input
                    id="streetAddress"
                    placeholder="123 Spice Market, Main Road"
                    value={settings.street_address}
                    onChange={(e) => setSettings(prev => ({ ...prev, street_address: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="Mumbai"
                      value={settings.city}
                      onChange={(e) => setSettings(prev => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      placeholder="Maharashtra"
                      value={settings.state}
                      onChange={(e) => setSettings(prev => ({ ...prev, state: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      placeholder="400001"
                      value={settings.postal_code}
                      onChange={(e) => setSettings(prev => ({ ...prev, postal_code: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      placeholder="IN"
                      value={settings.country}
                      onChange={(e) => setSettings(prev => ({ ...prev, country: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Preview Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Google Search Preview
              </CardTitle>
              <CardDescription>
                How your store might appear in Google search results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-white dark:bg-zinc-900 border rounded-lg p-4 max-w-xl">
                <div className="text-sm text-muted-foreground mb-1">
                  {storeSlug}.digitaldukandar.in
                </div>
                <div className="text-lg text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer">
                  {storeName}{settings.alternate_names ? ` (${settings.alternate_names.split(',')[0]?.trim()})` : ''} - Online Store
                </div>
                <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {settings.seo_description || `Shop at ${storeName}. Quality products at great prices.`}
                </div>
                {(settings.business_phone || settings.city) && (
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    {settings.business_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {settings.business_phone}
                      </span>
                    )}
                    {settings.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {settings.city}, {settings.state}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Google Indexing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Google Indexing
              </CardTitle>
              <CardDescription>
                Submit your store to Google for faster indexing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Info */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-100">Two ways to get indexed:</p>
                    <ul className="mt-2 space-y-1 text-blue-800 dark:text-blue-200">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 dark:text-blue-400">•</span>
                        <span><strong>Submit Sitemap:</strong> Traditional method, takes 3-7 days</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 dark:text-blue-400">•</span>
                        <span><strong>Request Indexing:</strong> Faster method using Google Indexing API, appears within hours</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Sitemap Submission */}
                <div className="space-y-3">
                  <div>
                    <h3 className="font-medium text-sm mb-1">Submit Sitemap</h3>
                    <p className="text-xs text-muted-foreground">
                      Submit your sitemap to Google Search Console (slower but comprehensive)
                    </p>
                  </div>
                  <Button
                    onClick={submitSitemap}
                    disabled={isSubmittingSitemap}
                    variant="outline"
                    className="w-full"
                  >
                    {isSubmittingSitemap ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Submit Sitemap
                      </>
                    )}
                  </Button>
                  {sitemapResult && (
                    <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${
                      sitemapResult.success
                        ? 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                    }`}>
                      {sitemapResult.success ? (
                        <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        {sitemapResult.success ? (
                          <p className="font-medium">Submitted successfully!</p>
                        ) : (
                          <>
                            <p className="font-medium">Submission failed</p>
                            {sitemapResult.error && (
                              <p className="text-xs mt-1 opacity-90">{sitemapResult.error}</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Immediate Indexing */}
                <div className="space-y-3">
                  <div>
                    <h3 className="font-medium text-sm mb-1 flex items-center gap-1">
                      Request Indexing
                      <Badge variant="secondary" className="text-xs">Faster</Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Request immediate indexing via Google Indexing API (appears within hours)
                    </p>
                  </div>
                  <Button
                    onClick={requestIndexing}
                    disabled={isIndexing}
                    className="w-full"
                  >
                    {isIndexing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Requesting...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Request Indexing
                      </>
                    )}
                  </Button>
                  {indexingResult && (
                    <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${
                      indexingResult.success
                        ? 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                    }`}>
                      {indexingResult.success ? (
                        <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        {indexingResult.success ? (
                          <p className="font-medium">Indexing requested!</p>
                        ) : (
                          <>
                            <p className="font-medium">Request failed</p>
                            {indexingResult.error && (
                              <p className="text-xs mt-1 opacity-90">{indexingResult.error}</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-xs text-muted-foreground">
                <p className="font-medium mb-2">Note:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Sitemap is automatically submitted when you create/update your store</li>
                  <li>Use "Request Indexing" when you make important changes and need Google to re-crawl quickly</li>
                  <li>You can use both methods - they complement each other</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Save Button (bottom) */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} size="lg">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save SEO Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </TooltipProvider>
  );
};

export default SEOSettingsPage;
