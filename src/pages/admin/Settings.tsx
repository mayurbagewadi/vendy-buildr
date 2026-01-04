import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Save, Upload, Store, Phone, Mail, MapPin, MessageCircle, Image, Plus, X, Globe, Lock, Download, FileText, ChevronDown, AlertTriangle, Trash2, HardDrive } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import AdminLayout from "@/components/admin/AdminLayout";
import { useSubscriptionLimits } from "@/hooks/useSubscriptionLimits";
import { generateStoreTXT } from "@/lib/generateStoreTXT";
import { DeleteMyAccountModal } from "@/components/admin/DeleteMyAccountModal";
import { convertToDirectImageUrl } from "@/lib/imageUtils";

import { supabase } from "@/integrations/supabase/client";

const AdminSettings = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingFile, setIsGeneratingFile] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [isPoliciesOpen, setIsPoliciesOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [googleDriveConnected, setGoogleDriveConnected] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const subscriptionLimits = useSubscriptionLimits();
  const [formData, setFormData] = useState({
    storeName: "",
    logoUrl: "",
    heroBannerUrls: [] as string[],
    phone: "",
    email: "",
    address: "",
    whatsappNumber: "",
    currency: "INR",
    currencySymbol: "₹",
    customDomain: "",
    aiVoiceEmbedCode: "",
    forceLocationSharing: false,
    deliveryAreas: "",
    returnPolicy: "",
    shippingPolicy: "",
    termsConditions: "",
    privacyPolicy: "",
  });
  const [newBannerUrl, setNewBannerUrl] = useState("");

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Store user email for delete modal
        setUserEmail(user.email || "");

        // Check if we're returning from Google OAuth with new tokens
        const { data: { session } } = await supabase.auth.getSession();
        const providerToken = session?.provider_token;
        const providerRefreshToken = session?.provider_refresh_token;

      // Load from stores table
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (storeError) {
        console.error('Error loading store:', storeError);
      }

        // Store the store ID for PDF generation
        if (store?.id) {
          setStoreId(store.id);
        }

        // If we have new Google tokens and a store, save them
        if (store && providerToken) {
          const updates: any = {
            google_access_token: providerToken,
          };

          if (providerRefreshToken) {
            const tokenExpiry = new Date(Date.now() + 3600 * 1000).toISOString();
            updates.google_refresh_token = providerRefreshToken;
            updates.google_token_expiry = tokenExpiry;
          }

          await supabase
            .from('stores')
            .update(updates)
            .eq('id', store.id);

          toast({
            title: "Google Drive Connected",
            description: "You can now upload images to Google Drive.",
          });
          
          // Update state
          setGoogleDriveConnected(true);
        } else {
          // Check if Google Drive is connected (access token is enough to treat as connected)
          setGoogleDriveConnected(!!store?.google_access_token);
        }

        // Load phone from profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone, email')
          .eq('user_id', user.id)
          .single();

        setFormData({
          storeName: store?.name || "",
          logoUrl: store?.logo_url || "",
          heroBannerUrls: (store?.hero_banner_urls || []) as string[],
          phone: profile?.phone || "",
          email: profile?.email || "",
          address: store?.address || "",
          whatsappNumber: store?.whatsapp_number || "",
          currency: "INR",
          currencySymbol: "₹",
          customDomain: store?.custom_domain || "",
          aiVoiceEmbedCode: store?.ai_voice_embed_code || "",
          forceLocationSharing: store?.force_location_sharing || false,
          deliveryAreas: (store?.policies as any)?.deliveryAreas || "",
          returnPolicy: (store?.policies as any)?.returnPolicy || "",
          shippingPolicy: (store?.policies as any)?.shippingPolicy || "",
          termsConditions: (store?.policies as any)?.termsConditions || "",
          privacyPolicy: (store?.policies as any)?.privacyPolicy || "",
        });
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    
    loadSettings();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddBannerUrl = () => {
    if (!newBannerUrl.trim()) {
      toast({
        variant: "destructive",
        title: "Invalid URL",
        description: "Please enter a valid image URL",
      });
      return;
    }

    // Convert Google Drive share link to direct link
    let imageUrl = newBannerUrl.trim();
    if (imageUrl.includes('drive.google.com')) {
      const converted = convertToDirectImageUrl(imageUrl);
      if (converted) {
        imageUrl = converted;
        toast({
          title: "Google Drive Link Added",
          description: "Make sure the file is set to 'Anyone with the link can view'",
        });
      }
    }

    setFormData(prev => ({
      ...prev,
      heroBannerUrls: [...prev.heroBannerUrls, imageUrl]
    }));
    setNewBannerUrl("");
  };

  const handleRemoveBannerUrl = (index: number) => {
    setFormData(prev => ({
      ...prev,
      heroBannerUrls: prev.heroBannerUrls.filter((_, i) => i !== index)
    }));
  };

  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    // Validate all files first
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/');
      if (!isValidType) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a valid image file`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    if (!googleDriveConnected) {
      toast({
        title: "Google Drive Not Connected",
        description: "Please connect your Google Drive account below to upload images directly.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    setIsUploadingBanner(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      for (const file of validFiles) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await supabase.functions.invoke('upload-to-drive', {
          body: formData,
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Failed to upload image');
        }

        if (response.data?.imageUrl) {
          setFormData(prev => ({
            ...prev,
            heroBannerUrls: [...prev.heroBannerUrls, response.data.imageUrl]
          }));
          toast({
            title: "Banner Uploaded",
            description: `${file.name} uploaded successfully to Google Drive`,
          });
        }
      }
    } catch (error: any) {
      let errorMessage = error.message || '';
      if (error.context?.body) {
        try {
          const errorBody = JSON.parse(error.context.body);
          errorMessage = errorBody.error || errorBody.message || errorMessage;
        } catch (e) {
          // Could not parse error body
        }
      }

      if (errorMessage.toLowerCase().includes('drive') &&
          errorMessage.toLowerCase().includes('not connected')) {
        toast({
          title: "Google Drive Not Connected",
          description: "Please connect your Google Drive account below first.",
          variant: "destructive",
          duration: 6000,
        });
      } else if (errorMessage.toLowerCase().includes('token') || errorMessage.toLowerCase().includes('expired')) {
        toast({
          title: "Google Drive Connection Expired",
          description: "Your Google Drive connection has expired. Please reconnect below.",
          variant: "destructive",
          duration: 6000,
        });
      } else {
        toast({
          title: "Upload Failed",
          description: errorMessage || 'Failed to upload to Google Drive. Try using the URL option instead.',
          variant: "destructive",
          duration: 5000,
        });
      }
    } finally {
      setIsUploadingBanner(false);
      event.target.value = '';
    }
  };

  const handleDownloadStoreInfo = async () => {
    if (!storeId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Store ID not found. Please refresh the page.",
      });
      return;
    }

    setIsGeneratingFile(true);
    try {
      await generateStoreTXT(storeId);
      toast({
        title: "File Generated Successfully",
        description: "Your store information TXT file has been downloaded.",
      });
    } catch (error) {
      console.error('Error generating file:', error);
      toast({
        variant: "destructive",
        title: "File Generation Failed",
        description: "There was an error generating your file. Please try again.",
      });
    } finally {
      setIsGeneratingFile(false);
    }
  };

  const handleConnectGoogleDrive = async () => {
    try {
      setIsConnectingDrive(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/admin/settings`,
          scopes: 'https://www.googleapis.com/auth/drive.file',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Google Drive connection error:', error);
        toast({
          variant: "destructive",
          title: "Connection Failed",
          description: error.message,
        });
      }
    } catch (error) {
      console.error('Error connecting Google Drive:', error);
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: "Failed to initiate Google Drive connection",
      });
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate required fields
      if (!formData.storeName.trim()) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Store name is required",
        });
        setIsLoading(false);
        return;
      }

      // Validate custom domain format if provided
      if (formData.customDomain.trim()) {
        // Check subscription permission
        if (!subscriptionLimits.enableCustomDomain) {
          toast({
            variant: "destructive",
            title: "Feature Not Available",
            description: "Custom domain is only available for Pro, Premium, and Enterprise plans. Please upgrade your subscription.",
          });
          setIsLoading(false);
          return;
        }

        // Validate domain format
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*\.[a-zA-Z]{2,}$/;
        const cleanDomain = formData.customDomain.trim().toLowerCase();

        if (cleanDomain.includes('http://') || cleanDomain.includes('https://')) {
          toast({
            variant: "destructive",
            title: "Invalid Domain Format",
            description: "Please enter domain without http:// or https:// (e.g., shop.yourdomain.com)",
          });
          setIsLoading(false);
          return;
        }

        if (!domainRegex.test(cleanDomain)) {
          toast({
            variant: "destructive",
            title: "Invalid Domain Format",
            description: "Please enter a valid domain name (e.g., shop.yourdomain.com)",
          });
          setIsLoading(false);
          return;
        }
      }

      // Validate WhatsApp number - prevent default number
      const cleanNumber = formData.whatsappNumber.replace(/[^0-9]/g, '');
      if (cleanNumber === '9876543210' || cleanNumber === '919876543210') {
        toast({
          variant: "destructive",
          title: "Invalid WhatsApp Number",
          description: "The default number 9876543210 is not allowed. Please enter your actual WhatsApp business number.",
        });
        setIsLoading(false);
        return;
      }

      // Validate WhatsApp number format
      if (formData.whatsappNumber.trim() && cleanNumber.length < 10) {
        toast({
          variant: "destructive",
          title: "Invalid WhatsApp Number",
          description: "Please enter a valid WhatsApp number with at least 10 digits.",
        });
        setIsLoading(false);
        return;
      }

      // Save to Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Update stores table
      const updateData: any = {
        name: formData.storeName,
        logo_url: formData.logoUrl || null,
        hero_banner_urls: formData.heroBannerUrls.length > 0 ? formData.heroBannerUrls : null,
        whatsapp_number: formData.whatsappNumber,
        address: formData.address || null,
        policies: {
          deliveryAreas: formData.deliveryAreas || null,
          returnPolicy: formData.returnPolicy || null,
          shippingPolicy: formData.shippingPolicy || null,
          termsConditions: formData.termsConditions || null,
          privacyPolicy: formData.privacyPolicy || null,
        }
      };

      // Only update custom_domain if user has permission
      if (subscriptionLimits.enableCustomDomain) {
        updateData.custom_domain = formData.customDomain.trim().toLowerCase() || null;
      }

      // Only update ai_voice_embed_code if user has permission
      if (subscriptionLimits.enableAiVoice) {
        updateData.ai_voice_embed_code = formData.aiVoiceEmbedCode.trim() || null;
      }

      // Only update force_location_sharing if user has location feature in their plan
      if (subscriptionLimits.enableLocationSharing) {
        updateData.force_location_sharing = formData.forceLocationSharing;
      }

      const { error: storeError } = await supabase
        .from('stores')
        .update(updateData)
        .eq('user_id', user.id);

      if (storeError) throw storeError;

      // Update profiles table
      if (formData.phone || formData.email) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            phone: formData.phone || null,
            email: formData.email || null,
          })
          .eq('user_id', user.id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
        }
      }
      
      toast({
        title: "Settings Saved",
        description: "Your store settings have been updated successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "There was an error saving your settings",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const settingSections = [
    {
      title: "Store Information",
      icon: Store,
      fields: [
        { key: "storeName", label: "Store Name", placeholder: "My Awesome Store", required: true },
        { key: "logoUrl", label: "Logo URL (Google Drive Link)", placeholder: "https://drive.google.com/..." },
      ]
    },
    {
      title: "Contact Information",
      icon: Phone,
      fields: [
        { key: "phone", label: "Phone Number", placeholder: "+1 (555) 123-4567" },
        { key: "email", label: "Email Address", placeholder: "contact@yourstore.com" },
        { key: "whatsappNumber", label: "WhatsApp Business Number", placeholder: "919876543210 (with country code, no spaces)" },
        { key: "address", label: "Store Address", placeholder: "123 Main St, City, State 12345", multiline: true },
      ]
    },
    {
      title: "Currency Settings",
      icon: Store,
      fields: [
        { key: "currencySymbol", label: "Currency Symbol", placeholder: "₹, $, €, £, etc." },
        { key: "currency", label: "Currency Code", placeholder: "INR, USD, EUR, GBP, etc." },
      ]
    }
  ];

  const policyFields = [
    { key: "deliveryAreas", label: "Delivery Areas", placeholder: "List areas where you deliver..." },
    { key: "returnPolicy", label: "Return Policy", placeholder: "Describe your return policy..." },
    { key: "shippingPolicy", label: "Shipping Policy", placeholder: "Describe your shipping terms..." },
    { key: "termsConditions", label: "Terms & Conditions", placeholder: "Your terms and conditions..." },
    { key: "privacyPolicy", label: "Privacy Policy", placeholder: "Describe how you collect, use, and protect customer data..." },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Store Settings</h1>
            <p className="text-muted-foreground mt-1">
              Configure your store information and policies
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          {/* Store Information & Contact Sections */}
          {settingSections.map((section, sectionIndex) => (
            <Card key={sectionIndex} className="admin-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <section.icon className="w-5 h-5 text-primary" />
                  </div>
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {section.fields.map((field, fieldIndex) => (
                    <div key={fieldIndex} className={field.multiline ? "md:col-span-2" : ""}>
                      <Label htmlFor={field.key} className="flex items-center gap-2">
                        {field.label}
                        {field.required && <span className="text-destructive">*</span>}
                      </Label>
                      {field.multiline ? (
                        <Textarea
                          id={field.key}
                          placeholder={field.placeholder}
                          value={String(formData[field.key as keyof typeof formData] || '')}
                          onChange={(e) => handleInputChange(field.key, e.target.value)}
                          className="admin-input min-h-[100px] mt-2"
                          required={field.required}
                        />
                      ) : (
                        <Input
                          id={field.key}
                          type="text"
                          placeholder={field.placeholder}
                          value={String(formData[field.key as keyof typeof formData] || '')}
                          onChange={(e) => handleInputChange(field.key, e.target.value)}
                          className="admin-input mt-2"
                          required={field.required}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Custom Domain Section */}
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                Custom Domain
              </CardTitle>
              <p className="text-muted-foreground">Connect your own domain to your store</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!subscriptionLimits.enableCustomDomain ? (
                <Alert>
                  <Lock className="h-4 w-4" />
                  <AlertDescription>
                    Custom domain is only available for Pro, Premium, and Enterprise plans.
                    <a href="/admin/subscription" className="ml-1 underline font-medium">
                      Upgrade your plan
                    </a> to use this feature.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div>
                    <Label htmlFor="customDomain">Custom Domain</Label>
                    <Input
                      id="customDomain"
                      type="text"
                      placeholder="yourdomain.com or www.yourdomain.com or shop.yourdomain.com"
                      value={formData.customDomain}
                      onChange={(e) => handleInputChange('customDomain', e.target.value)}
                      className="admin-input mt-2"
                      disabled={!subscriptionLimits.enableCustomDomain}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Enter your domain: <strong>yourdomain.com</strong> (root), <strong>www.yourdomain.com</strong>, or <strong>shop.yourdomain.com</strong>
                    </p>
                  </div>

                  {formData.customDomain && (() => {
                    const domain = formData.customDomain.trim();
                    const parts = domain.split('.');
                    const isRootDomain = parts.length === 2; // e.g., "sasumasale.com"
                    const subdomain = isRootDomain ? '@' : parts[0]; // e.g., "www" or "shop"

                    return (
                      <Alert>
                        <Globe className="h-4 w-4" />
                        <AlertDescription>
                          <div className="space-y-2">
                            <p className="font-medium">DNS Configuration Required:</p>
                            <p className="text-sm">
                              {isRootDomain
                                ? 'For root domain, add an A record pointing to your server IP:'
                                : 'For subdomain, add a CNAME record in your domain\'s DNS settings:'}
                            </p>
                            <div className="bg-muted p-2 rounded mt-2 font-mono text-xs">
                              {isRootDomain ? (
                                <>
                                  <div>Type: A</div>
                                  <div>Name: @ (or leave blank)</div>
                                  <div>Value: Your Server IP</div>
                                  <div className="mt-2 text-muted-foreground">Alternative: Use CNAME for www, then redirect @ to www</div>
                                </>
                              ) : (
                                <>
                                  <div>Type: CNAME</div>
                                  <div>Name: {subdomain}</div>
                                  <div>Value: yesgive.shop</div>
                                </>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              DNS changes may take up to 48 hours to propagate.
                            </p>
                          </div>
                        </AlertDescription>
                      </Alert>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>

          {/* Location Settings Section */}
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                Location Settings
              </CardTitle>
              <p className="text-muted-foreground">Control how location sharing works for your customers</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!subscriptionLimits.enableLocationSharing ? (
                <Alert>
                  <Lock className="h-4 w-4" />
                  <AlertDescription>
                    Location sharing is not available in your current plan.
                    <a href="/admin/subscription" className="ml-1 underline font-medium">
                      Upgrade your plan
                    </a> to use this feature.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="forceLocationSharing" className="text-base font-medium cursor-pointer">
                          Force Location Sharing
                        </Label>
                        {formData.forceLocationSharing && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                            Mandatory
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formData.forceLocationSharing
                          ? "Customers must share their location to place orders (mandatory)"
                          : "Location sharing is optional for customers (recommended)"}
                      </p>
                    </div>
                    <Switch
                      id="forceLocationSharing"
                      checked={formData.forceLocationSharing}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({ ...prev, forceLocationSharing: checked }))
                      }
                      className={`ml-4 ${formData.forceLocationSharing ? 'data-[state=checked]:bg-green-500' : ''}`}
                    />
                  </div>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Important:</strong> Forcing location sharing may reduce conversions.
                      We recommend keeping it optional unless you have specific delivery area requirements.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>

          {/* Hero Banner Carousel Section */}
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Image className="w-5 h-5 text-primary" />
                </div>
                Hero Banner Carousel (Multiple Images)
              </CardTitle>
              <p className="text-muted-foreground">Add multiple banner images for auto-sliding carousel (Recommended size: 1920x450px)</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Option 1: Upload from Device */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Option 1: Upload from Device</Label>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    id="bannerUpload"
                    accept="image/*"
                    multiple
                    onChange={handleBannerUpload}
                    className="hidden"
                    disabled={isUploadingBanner}
                  />
                  <label
                    htmlFor="bannerUpload"
                    className={`cursor-pointer flex flex-col items-center gap-3 ${isUploadingBanner ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isUploadingBanner ? (
                      <>
                        <div className="p-3 rounded-full bg-primary/10">
                          <Upload className="w-6 h-6 text-primary animate-pulse" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">Uploading to Google Drive...</p>
                          <p className="text-sm text-muted-foreground">Please wait</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-3 rounded-full bg-primary/10">
                          <Upload className="w-6 h-6 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">Click to upload banner images</p>
                          <p className="text-sm text-muted-foreground">
                            {googleDriveConnected
                              ? "Images will be uploaded to your Google Drive"
                              : "Connect Google Drive below to enable uploads"}
                          </p>
                        </div>
                      </>
                    )}
                  </label>
                </div>
                {!googleDriveConnected && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Connect your Google Drive account in the section below to upload images directly.
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">OR</span>
                </div>
              </div>

              {/* Option 2: Manual URL */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Option 2: Paste Google Drive URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="newBannerUrl"
                    type="text"
                    placeholder="https://drive.google.com/file/d/..."
                    value={newBannerUrl}
                    onChange={(e) => setNewBannerUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBannerUrl())}
                    className="admin-input flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleAddBannerUrl}
                    className="admin-button-primary"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste a Google Drive share link. Make sure the file is set to "Anyone with the link can view".
                </p>
              </div>

              {/* Current Banner Images with Previews */}
              {formData.heroBannerUrls.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-base font-medium">Current Banner Images ({formData.heroBannerUrls.length})</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {formData.heroBannerUrls.map((url, index) => (
                      <div key={index} className="relative group rounded-lg overflow-hidden border bg-muted">
                        <div className="aspect-[16/9] relative">
                          <img
                            src={url}
                            alt={`Banner ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23f0f0f0" width="100" height="100"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23999" font-size="12">Image Error</text></svg>';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                          <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                            {index + 1}
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveBannerUrl(index)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formData.heroBannerUrls.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No banner images added yet.</p>
                  <p className="text-xs mt-1">Upload images or paste URLs above to create a carousel.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Google Drive Connection Section */}
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <HardDrive className="w-5 h-5 text-primary" />
                </div>
                Google Drive Connection
              </CardTitle>
              <p className="text-muted-foreground">
                Connect your Google Drive to upload product images directly
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-medium">Status</Label>
                    {googleDriveConnected ? (
                      <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Connected
                      </span>
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full font-medium">
                        Not Connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {googleDriveConnected
                      ? "You can upload images to Google Drive from product pages"
                      : "Connect your Google Drive account to enable image uploads"}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleConnectGoogleDrive}
                  disabled={isConnectingDrive}
                  className={googleDriveConnected ? "admin-button" : "admin-button-primary"}
                >
                  {isConnectingDrive ? (
                    <>
                      <Upload className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : googleDriveConnected ? (
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

              {!googleDriveConnected && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Note:</strong> You'll be redirected to Google to grant Drive permissions.
                    Make sure to allow "See and download files from your Google Drive" permission.
                  </AlertDescription>
                </Alert>
              )}

              {googleDriveConnected && (
                <Alert className="border-green-500/20 bg-green-500/5">
                  <HardDrive className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-600 dark:text-green-400">
                    Your Google Drive is connected. You can now upload images directly when adding or editing products.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* AI Assistant - Combined Voice & Training Data Section */}
          <Card className="admin-card border-2 border-primary/20">
            <Collapsible open={isAIAssistantOpen} onOpenChange={setIsAIAssistantOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <MessageCircle className="w-5 h-5 text-primary" />
                    </div>
                    AI Assistant
                    {!subscriptionLimits.enableAiVoice && (
                      <Lock className="w-4 h-4 text-muted-foreground ml-2" />
                    )}
                    <ChevronDown
                      className={`ml-auto h-5 w-5 transition-transform duration-200 ${
                        isAIAssistantOpen ? 'transform rotate-180' : ''
                      }`}
                    />
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Configure AI voice assistant and training data for your store
                  </p>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="space-y-6 pt-6">
                  {/* Section 1: AI Voice Assistant */}
                  <div className="bg-muted/30 border rounded-lg p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-primary text-primary-foreground">
                        <MessageCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">AI Voice Assistant</h3>
                        <p className="text-sm text-muted-foreground">
                          {subscriptionLimits.enableAiVoice
                            ? "Add ElevenLabs conversational AI to your store"
                            : "Upgrade to premium to enable"}
                        </p>
                      </div>
                    </div>

                    {!subscriptionLimits.enableAiVoice ? (
                      <Alert>
                        <Lock className="h-4 w-4" />
                        <AlertDescription>
                          Premium feature - Upgrade your subscription to enable voice interactions
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-3">
                        <Label htmlFor="aiVoiceEmbedCode" className="text-base">ElevenLabs Embed Code</Label>
                        <Textarea
                          id="aiVoiceEmbedCode"
                          placeholder='<elevenlabs-convai agent-id="your_agent_id"></elevenlabs-convai><script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="text/javascript"></script>'
                          value={formData.aiVoiceEmbedCode}
                          onChange={(e) => handleInputChange('aiVoiceEmbedCode', e.target.value)}
                          className="admin-input min-h-[100px] font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Paste your ElevenLabs embed code to enable AI voice on your store
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Section 2: AI Agent Training Data */}
                  <div className="bg-muted/30 border rounded-lg p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-primary text-primary-foreground">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Training Data Export</h3>
                        <p className="text-sm text-muted-foreground">
                          Download store data to train your AI agent
                        </p>
                      </div>
                    </div>

                    <div className="bg-background/50 p-4 rounded-lg border space-y-3">
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-primary mt-0.5" />
                        <p className="text-sm text-muted-foreground">
                          Export includes store info, policies, products, and variants - ready for AI training
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={handleDownloadStoreInfo}
                      disabled={isGeneratingFile || !storeId}
                      className="w-full admin-button-primary"
                      size="lg"
                    >
                      {isGeneratingFile ? (
                        <>
                          <Upload className="w-4 h-4 mr-2 animate-spin" />
                          Generating File...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Download Training Data (TXT)
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Policies Section */}
          <Collapsible open={isPoliciesOpen} onOpenChange={setIsPoliciesOpen}>
            <Card className="admin-card">
              <CardHeader>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between w-full">
                    <CardTitle className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <MessageCircle className="w-5 h-5 text-primary" />
                      </div>
                      Store Policies
                    </CardTitle>
                    <ChevronDown 
                      className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
                        isPoliciesOpen ? 'transform rotate-180' : ''
                      }`}
                    />
                  </div>
                </CollapsibleTrigger>
                <p className="text-muted-foreground text-left mt-2">Define your store policies and terms</p>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  {policyFields.map((field, index) => (
                    <div key={index}>
                      <Label htmlFor={field.key}>{field.label}</Label>
                      <Textarea
                        id={field.key}
                        placeholder={field.placeholder}
                        value={String(formData[field.key as keyof typeof formData] || '')}
                        onChange={(e) => handleInputChange(field.key, e.target.value)}
                        className="admin-input min-h-[120px] mt-2"
                      />
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* File Upload Tips */}
          <Card className="admin-card bg-muted/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Upload className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Image Upload Tips</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Upload images to Google Drive and use the sharing link</li>
                    <li>• Make sure images are set to "Anyone with the link can view"</li>
                    <li>• Recommended logo size: 200x80px (PNG/JPG)</li>
                    <li>• Recommended hero banner: 1920x450px (JPG/PNG)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              className="admin-button-primary min-w-[150px]"
              disabled={isLoading}
            >
              {isLoading ? (
                "Saving..."
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Danger Zone - Outside form */}
        <Card className="admin-card border-2 border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-destructive">
              <div className="p-2 rounded-lg bg-destructive/20">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              Danger Zone
            </CardTitle>
            <p className="text-muted-foreground">
              Irreversible and destructive actions
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-background rounded-lg border border-destructive/30">
              <div className="space-y-1">
                <h4 className="font-semibold text-foreground">Delete My Account</h4>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account, store, and all associated data
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteAccountModalOpen(true)}
                className="sm:ml-auto whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Delete Account Modal */}
        <DeleteMyAccountModal
          open={deleteAccountModalOpen}
          onClose={() => setDeleteAccountModalOpen(false)}
          userEmail={userEmail}
          storeName={formData.storeName}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;