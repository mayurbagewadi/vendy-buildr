import { useState, useEffect, useRef } from "react";
import Lottie from "lottie-react";
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
  XCircle,
  Link2,
  Link2Off
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
  const [googleAnim, setGoogleAnim] = useState<any>(null);
  const lottieRef = useRef<any>(null);
  const animContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [isSubmittingSitemap, setIsSubmittingSitemap] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [sitemapResult, setSitemapResult] = useState<any>(null);
  const [indexingResult, setIndexingResult] = useState<any>(null);
  const [gscConnected, setGscConnected] = useState(false);
  const [gscEmail, setGscEmail] = useState("");
  const [gscSites, setGscSites] = useState<string[]>([]);
  const [isConnectingGsc, setIsConnectingGsc] = useState(false);
  const [isVerifyingGsc, setIsVerifyingGsc] = useState(false);
  const [gaMeasurementId, setGaMeasurementId] = useState("");

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
    fetch('/google-animation.json').then(r => r.json()).then(setGoogleAnim).catch(() => {});
  }, []);

  useEffect(() => {
    if (!animContainerRef.current || !googleAnim) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          lottieRef.current?.play();
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(animContainerRef.current);
    return () => observer.disconnect();
  }, [googleAnim]);

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
      setGaMeasurementId((store as any).ga_measurement_id || "");
      if ((store as any).gsc_access_token) {
        verifyGsc();
      }

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
    if (gaMeasurementId && !/^G-[A-Z0-9]+$/.test(gaMeasurementId)) {
      toast({ variant: "destructive", title: "Invalid GA Measurement ID", description: "Must be in format G-XXXXXXXXXX (e.g. G-ABC123DEF4)" });
      return;
    }

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
          ga_measurement_id: gaMeasurementId || null,
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
    if (!gscConnected) {
      toast({ variant: 'destructive', title: 'Not Connected', description: 'Please connect Google Search Console first.' });
      return;
    }
    setIsSubmittingSitemap(true);
    setSitemapResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated. Please login again.');

      const { data, error } = await supabase.functions.invoke('gsc-oauth', {
        body: { action: 'submit_sitemap' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error || !data?.success) throw new Error(data?.error ?? 'Failed to submit sitemap');

      setSitemapResult({ success: true });
      toast({ title: 'Sitemap Submitted!', description: 'Your sitemap has been submitted via your Google Search Console account.' });
    } catch (error: any) {
      setSitemapResult({ success: false, error: error.message });
      toast({ variant: 'destructive', title: 'Submission Failed', description: error.message });
    } finally {
      setIsSubmittingSitemap(false);
    }
  };

  const requestIndexing = async () => {
    if (!gscConnected) {
      toast({ variant: 'destructive', title: 'Not Connected', description: 'Please connect Google Search Console first.' });
      return;
    }
    setIsIndexing(true);
    setIndexingResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated. Please login again.');

      const { data, error } = await supabase.functions.invoke('gsc-oauth', {
        body: { action: 'request_indexing' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error || !data?.success) throw new Error(data?.error ?? 'Failed to request indexing');

      setIndexingResult({ success: true });
      toast({ title: 'Indexing Requested!', description: 'Google has been notified to index your store.' });
    } catch (error: any) {
      setIndexingResult({ success: false, error: error.message });
      toast({ variant: 'destructive', title: 'Indexing Failed', description: error.message });
    } finally {
      setIsIndexing(false);
    }
  };

  // ── GIS utilities ─────────────────────────────────────────────────────
  const loadGISScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).google?.accounts?.oauth2) { resolve(); return; }
      const existing = document.getElementById('google-gis-script');
      if (existing) { existing.addEventListener('load', () => resolve()); return; }
      const script = document.createElement('script');
      script.id = 'google-gis-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    });
  };

  const requestGoogleCode = (clientId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const client = (window as any).google.accounts.oauth2.initCodeClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/siteverification https://www.googleapis.com/auth/indexing',
          ux_mode: 'popup',
          callback: (response: any) => {
            if (response.code) resolve(response.code);
            else reject(new Error(response.error ?? 'Google OAuth cancelled'));
          },
        });
        client.requestCode();
      } catch (err: any) {
        reject(err);
      }
    });
  };

  const verifyGsc = async () => {
    setIsVerifyingGsc(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase.functions.invoke('gsc-oauth', {
        body: { action: 'verify' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || !data) { setGscConnected(false); return; }
      setGscConnected(data.connected ?? false);
      setGscEmail(data.email ?? '');
      setGscSites(data.sites ?? []);
    } catch {
      setGscConnected(false);
    } finally {
      setIsVerifyingGsc(false);
    }
  };

  const handleConnectGsc = async () => {
    setIsConnectingGsc(true);
    try {
      const { data: configData, error: configError } = await supabase.functions.invoke('gsc-oauth', {
        body: { action: 'get_client_id' },
      });
      if (configError || !configData?.client_id) throw new Error('Failed to get OAuth config');

      await loadGISScript();
      const code = await requestGoogleCode(configData.client_id);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data: exchangeData, error: exchangeError } = await supabase.functions.invoke('gsc-oauth', {
        body: { action: 'exchange_code', code },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (exchangeError || !exchangeData?.success) throw new Error('Failed to save Google credentials');

      // Verify ownership via Google Site Verification API (0-friction — Nginx serves the file)
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('gsc-oauth', {
        body: { action: 'setup_verification' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (verifyError || !verifyData?.success) {
        toast({
          variant: 'destructive',
          title: 'Verification Failed',
          description: verifyData?.error ?? 'Google could not verify your store. Make sure your store is live and try again.',
        });
        setIsConnectingGsc(false);
        return;
      }

      await verifyGsc();

      toast({ title: 'Google Search Console Connected', description: 'Your store is now verified and registered in Google Search Console.' });
    } catch (err: any) {
      if (err.message !== 'Google OAuth cancelled') {
        toast({ variant: 'destructive', title: 'Connection Failed', description: err.message });
      }
    } finally {
      setIsConnectingGsc(false);
    }
  };

  const handleDisconnectGsc = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.functions.invoke('gsc-oauth', {
        body: { action: 'disconnect' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setGscConnected(false);
      setGscEmail('');
      setGscSites([]);
      toast({ title: 'Disconnected', description: 'Google Search Console has been disconnected.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
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
            <p className="text-muted-foreground mt-1">Optimize your store for search engines like Google</p>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Save className="w-4 h-4 mr-2" />Save Settings</>}
          </Button>
        </div>

        {/* Store Details — 2×2 grid */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5" />Basic Information</CardTitle>
              <CardDescription>Help customers find your store with different search terms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Store Name</Label>
                <Input value={storeName} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Change this in Settings → Store Details</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    Also Known As
                    <Tooltip>
                      <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs"><p>Add variations of your store name customers might search for. Separate with commas.</p></TooltipContent>
                    </Tooltip>
                  </Label>
                  <Button type="button" variant="ghost" size="sm" onClick={generateAlternateNames} className="h-7 text-xs">
                    <Sparkles className="w-3 h-3 mr-1" />Auto Generate
                  </Button>
                </div>
                <Input
                  placeholder="Sasu Masale, Sasu Masaale, SasuMasaale"
                  value={settings.alternate_names}
                  onChange={(e) => setSettings(prev => ({ ...prev, alternate_names: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  SEO Description
                  <Badge variant="secondary" className="text-xs">Important</Badge>
                </Label>
                <Textarea
                  placeholder="Fresh Indian spices store offering premium quality masale..."
                  value={settings.seo_description}
                  onChange={(e) => setSettings(prev => ({ ...prev, seo_description: e.target.value }))}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">{settings.seo_description.length}/160 characters (recommended)</p>
              </div>
              <div className="space-y-2">
                <Label>Price Range</Label>
                <select
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
              <CardTitle className="flex items-center gap-2"><Phone className="w-5 h-5" />Contact Information</CardTitle>
              <CardDescription>Help customers reach you directly from Google search</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Phone className="w-4 h-4" />Business Phone</Label>
                <Input placeholder="+91-9876543210" value={settings.business_phone} onChange={(e) => setSettings(prev => ({ ...prev, business_phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Mail className="w-4 h-4" />Business Email</Label>
                <Input type="email" placeholder="contact@yourstore.com" value={settings.business_email} onChange={(e) => setSettings(prev => ({ ...prev, business_email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Clock className="w-4 h-4" />Opening Hours</Label>
                <Input placeholder="Mon-Sat: 9AM-9PM, Sun: 10AM-6PM" value={settings.opening_hours} onChange={(e) => setSettings(prev => ({ ...prev, opening_hours: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          {/* Business Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" />Business Address</CardTitle>
              <CardDescription>Appears on Google Maps and local search results</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Street Address</Label>
                <Input placeholder="123 Spice Market, Main Road" value={settings.street_address} onChange={(e) => setSettings(prev => ({ ...prev, street_address: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input placeholder="Mumbai" value={settings.city} onChange={(e) => setSettings(prev => ({ ...prev, city: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input placeholder="Maharashtra" value={settings.state} onChange={(e) => setSettings(prev => ({ ...prev, state: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Postal Code</Label>
                  <Input placeholder="400001" value={settings.postal_code} onChange={(e) => setSettings(prev => ({ ...prev, postal_code: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input placeholder="IN" value={settings.country} onChange={(e) => setSettings(prev => ({ ...prev, country: e.target.value }))} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Google Search Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Eye className="w-5 h-5" />Google Search Preview</CardTitle>
              <CardDescription>How your store might appear in Google search results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-white dark:bg-zinc-900 border rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">{storeSlug}.digitaldukandar.in</div>
                <div className="text-lg text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer">
                  {storeName}{settings.alternate_names ? ` (${settings.alternate_names.split(',')[0]?.trim()})` : ''} - Online Store
                </div>
                <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {settings.seo_description || `Shop at ${storeName}. Quality products at great prices.`}
                </div>
                {(settings.business_phone || settings.city) && (
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    {settings.business_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{settings.business_phone}</span>}
                    {settings.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{settings.city}, {settings.state}</span>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Google Integrations — single grouped card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              {googleAnim && (
                <div ref={animContainerRef} style={{ width: 160, height: 56, overflow: 'hidden', flexShrink: 0 }}>
                  <Lottie
                    lottieRef={lottieRef}
                    animationData={googleAnim}
                    loop={false}
                    autoplay={false}
                    style={{ width: 336, height: 336, marginTop: '-140px', marginBottom: '-140px', marginLeft: '-88px', marginRight: '-88px', display: 'block' }}
                  />
                </div>
              )}
              Integrations
            </CardTitle>
            <CardDescription>Connect Google tools to verify ownership, boost indexing, and track visitors</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">

            {/* — Google Search Console — */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/search-console.svg" alt="Google Search Console" className="w-4 h-4" />
                  <span className="font-medium text-sm">Google Search Console</span>
                  <Badge variant="secondary" className="text-xs">Recommended</Badge>
                </div>
                {gscConnected && (
                  <Button variant="outline" size="sm" onClick={handleDisconnectGsc}>
                    <Link2Off className="w-3.5 h-3.5 mr-1.5" />Disconnect
                  </Button>
                )}
              </div>

              {isVerifyingGsc ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />Verifying connection...
                </div>
              ) : gscConnected ? (
                <div className="space-y-4">
                  {/* Connected badge */}
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-green-700 dark:text-green-400">Connected</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground text-xs">{gscEmail}</span>
                  </div>
                  {gscSites.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground">Verified properties ({gscSites.length})</p>
                      {gscSites.slice(0, 3).map((site) => (
                        <div key={site} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />{site}
                        </div>
                      ))}
                      {gscSites.length > 3 && <p className="text-xs text-muted-foreground">+{gscSites.length - 3} more</p>}
                    </div>
                  )}

                  {/* Indexing actions — only visible when connected */}
                  <div className="pt-3 border-t border-border/60 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Indexing</span> — Submit sitemap (3–7 days) or request immediate crawl (within hours)
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Button onClick={submitSitemap} disabled={isSubmittingSitemap} variant="outline" size="sm" className="w-full">
                          {isSubmittingSitemap
                            ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Submitting...</>
                            : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Submit Sitemap</>}
                        </Button>
                        {sitemapResult && (
                          <div className={`flex items-center gap-1.5 text-xs p-2 rounded-md ${sitemapResult.success ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400'}`}>
                            {sitemapResult.success ? <CheckCircle className="w-3 h-3 flex-shrink-0" /> : <XCircle className="w-3 h-3 flex-shrink-0" />}
                            <span className="truncate">{sitemapResult.success ? 'Submitted!' : sitemapResult.error}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Button onClick={requestIndexing} disabled={isIndexing} size="sm" className="w-full">
                          {isIndexing
                            ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Requesting...</>
                            : <><Zap className="w-3.5 h-3.5 mr-1.5" />Request Indexing</>}
                        </Button>
                        {indexingResult && (
                          <div className={`flex items-center gap-1.5 text-xs p-2 rounded-md ${indexingResult.success ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400'}`}>
                            {indexingResult.success ? <CheckCircle className="w-3 h-3 flex-shrink-0" /> : <XCircle className="w-3 h-3 flex-shrink-0" />}
                            <span className="truncate">{indexingResult.success ? 'Requested!' : indexingResult.error}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Connect your Google account to unlock search tools for your store.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span><span className="font-medium text-foreground">Submit Sitemap</span> — tell Google all your pages (3–7 days)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span><span className="font-medium text-foreground">Request Indexing</span> — fast crawl within hours</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span><span className="font-medium text-foreground">Verify Ownership</span> — prove your store to Google automatically</span>
                    </div>
                  </div>
                  <Button onClick={handleConnectGsc} disabled={isConnectingGsc} variant="outline" size="sm">
                    {isConnectingGsc
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Connecting...</>
                      : <><Link2 className="w-4 h-4 mr-2" />Connect Google Search Console</>}
                  </Button>
                </div>
              )}
            </div>

            {/* — Google Analytics — */}
            <div className="px-6 py-5 space-y-3">
              <div className="flex items-center gap-2">
                <img src="/google-analytics.svg" alt="Google Analytics" className="w-4 h-4" />
                <span className="font-medium text-sm">Google Analytics</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gaMeasurementId" className="text-xs text-muted-foreground">GA4 Measurement ID</Label>
                <Input
                  id="gaMeasurementId"
                  placeholder="G-XXXXXXXXXX"
                  value={gaMeasurementId}
                  onChange={(e) => setGaMeasurementId(e.target.value.toUpperCase())}
                  className="font-mono max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Find this in Google Analytics → Admin → Data Streams. Leave empty to disable.
                </p>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} size="lg">
            {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Save className="w-4 h-4 mr-2" />Save SEO Settings</>}
          </Button>
        </div>

      </div>
    </TooltipProvider>
  );
};

export default SEOSettingsPage;
