import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Save, Upload, Store, Phone, Mail, MapPin, MessageCircle, Image, Plus, X, Globe, Lock, Download, FileText, ChevronDown, AlertTriangle, Trash2, HardDrive, Loader2, CheckCircle2, CreditCard, Eye, EyeOff, ExternalLink, Settings as SettingsIcon, AlertCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSubscriptionLimits } from "@/hooks/useSubscriptionLimits";
import { generateStoreTXT } from "@/lib/generateStoreTXT";
import { DeleteMyAccountModal } from "@/components/admin/DeleteMyAccountModal";
import { convertToDirectImageUrl } from "@/lib/imageUtils";
import { compressImage } from "@/lib/imageCompression";

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
  const [uploadingFiles, setUploadingFiles] = useState<{name: string; progress: number}[]>([]);
  const [uploadDestination, setUploadDestination] = useState<'drive' | 'vps'>('vps');
  const [showSecrets, setShowSecrets] = useState({
    razorpay_key_secret: false,
    phonepe_salt_key: false,
    cashfree_secret_key: false,
    payu_merchant_salt: false,
    paytm_merchant_key: false,
    stripe_secret_key: false,
  });
  const [openGatewayDialog, setOpenGatewayDialog] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
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
    // Payment Gateway Credentials
    razorpay_enabled: false,
    razorpay_key_id: "",
    razorpay_key_secret: "",
    phonepe_enabled: false,
    phonepe_merchant_id: "",
    phonepe_salt_key: "",
    phonepe_salt_index: "",
    cashfree_enabled: false,
    cashfree_app_id: "",
    cashfree_secret_key: "",
    payu_enabled: false,
    payu_merchant_key: "",
    payu_merchant_salt: "",
    paytm_enabled: false,
    paytm_merchant_id: "",
    paytm_merchant_key: "",
    stripe_enabled: false,
    stripe_publishable_key: "",
    stripe_secret_key: "",
    // Payment mode
    payment_mode: "online_and_cod" as "online_only" | "online_and_cod",
  });
  const [newBannerUrl, setNewBannerUrl] = useState("");
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit, setStorageLimit] = useState(100);
  const [mediaLibrary, setMediaLibrary] = useState<any[]>([]);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'products' | 'categories' | 'banners'>('all');
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [pendingBannerFiles, setPendingBannerFiles] = useState<File[]>([]); // Store files until save (VPS only)
  const [bannerPreviewUrls, setBannerPreviewUrls] = useState<string[]>([]); // Preview URLs for display (VPS only)

  const loadSettings = useCallback(async () => {
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

      // Set storage tracking
      setStorageUsed(store?.storage_used_mb || 0);
      setStorageLimit(store?.storage_limit_mb || 100);

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

        // Don't show success toast yet - verify connection first
      }

      // Always verify Drive connection with actual API call
      await verifyDriveConnection();

      // Load phone from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone, email')
        .eq('user_id', user.id)
        .single();

      const pgCreds = (store?.payment_gateway_credentials as any) || {};

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
        // Payment Gateway Credentials
        razorpay_enabled: pgCreds?.razorpay?.enabled || false,
        razorpay_key_id: pgCreds?.razorpay?.key_id || "",
        razorpay_key_secret: pgCreds?.razorpay?.key_secret || "",
        phonepe_enabled: pgCreds?.phonepe?.enabled || false,
        phonepe_merchant_id: pgCreds?.phonepe?.merchant_id || "",
        phonepe_salt_key: pgCreds?.phonepe?.salt_key || "",
        phonepe_salt_index: pgCreds?.phonepe?.salt_index || "",
        cashfree_enabled: pgCreds?.cashfree?.enabled || false,
        cashfree_app_id: pgCreds?.cashfree?.app_id || "",
        cashfree_secret_key: pgCreds?.cashfree?.secret_key || "",
        payu_enabled: pgCreds?.payu?.enabled || false,
        payu_merchant_key: pgCreds?.payu?.merchant_key || "",
        payu_merchant_salt: pgCreds?.payu?.merchant_salt || "",
        paytm_enabled: pgCreds?.paytm?.enabled || false,
        paytm_merchant_id: pgCreds?.paytm?.merchant_id || "",
        paytm_merchant_key: pgCreds?.paytm?.merchant_key || "",
        stripe_enabled: pgCreds?.stripe?.enabled || false,
        stripe_publishable_key: pgCreds?.stripe?.publishable_key || "",
        stripe_secret_key: pgCreds?.stripe?.secret_key || "",
        // Payment mode
        payment_mode: (store?.payment_mode as "online_only" | "online_and_cod") || "online_and_cod",
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadMediaLibrary();
  }, [loadSettings]);

  const loadMediaLibrary = async () => {
    try {
      setIsLoadingMedia(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!store) return;

      const { data, error } = await supabase
        .from("media_library")
        .select("*")
        .eq("store_id", store.id)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setMediaLibrary(data || []);
    } catch (error: any) {
      console.error('Error loading media library:', error);
    } finally {
      setIsLoadingMedia(false);
    }
  };

  const verifyDriveConnection = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('verify-drive-connection', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Drive verification error:', error);
        setGoogleDriveConnected(false);
        return;
      }

      if (data?.connected) {
        setGoogleDriveConnected(true);
        // Only show success toast if we just connected (when there are new tokens)
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.provider_token) {
          toast({
            title: "Google Drive Connected",
            description: "You can now upload images to Google Drive.",
          });
        }
      } else {
        setGoogleDriveConnected(false);
        console.log('Drive not connected:', data?.reason);
      }
    } catch (error: any) {
      console.error('Error verifying Drive connection:', error);
      setGoogleDriveConnected(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCopyImageUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "URL Copied",
      description: "Image URL copied to clipboard",
    });
  };

  const handleDeleteFromMediaLibrary = async (imageUrl: string) => {
    try {
      // 1. Delete from VPS
      const response = await fetch('https://digitaldukandar.in/api/delete.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl }),
      });

      const result = await response.json();
      console.log('VPS delete response:', result);

      // 2. Delete from media_library table in database
      const { error: dbError } = await supabase
        .from('media_library')
        .delete()
        .eq('file_url', imageUrl);

      if (dbError) {
        console.error('Failed to delete from database:', dbError);
      }

      // 3. Update storage usage
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: store } = await supabase
          .from('stores')
          .select('id, storage_used_mb')
          .eq('user_id', user.id)
          .single();

        if (store) {
          // Get the file size from media library record before deletion
          const mediaRecord = mediaLibrary.find(m => m.file_url === imageUrl);
          if (mediaRecord?.file_size_mb) {
            const newStorage = Math.max(0, (store.storage_used_mb || 0) - mediaRecord.file_size_mb);
            await supabase
              .from('stores')
              .update({ storage_used_mb: newStorage })
              .eq('id', store.id);
          }
        }
      }

      toast({
        title: "Image Deleted",
        description: "Image removed from media library",
      });

      // Reload media library
      loadMediaLibrary();
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete image",
        variant: "destructive",
      });
    }
  };

  // Auto-save with debouncing
  useEffect(() => {
    // Skip auto-save on initial load
    if (isInitialLoad) return;

    const timeoutId = setTimeout(() => {
      performAutoSave();
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [formData, isInitialLoad]);

  // Auto-save function (without strict validation)
  const performAutoSave = async () => {
    try {
      setAutoSaveStatus('saving');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Build update data
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
        },
        payment_gateway_credentials: {
          razorpay: {
            enabled: formData.razorpay_enabled,
            key_id: formData.razorpay_key_id || null,
            key_secret: formData.razorpay_key_secret || null,
          },
          phonepe: {
            enabled: formData.phonepe_enabled,
            merchant_id: formData.phonepe_merchant_id || null,
            salt_key: formData.phonepe_salt_key || null,
            salt_index: formData.phonepe_salt_index || null,
          },
          cashfree: {
            enabled: formData.cashfree_enabled,
            app_id: formData.cashfree_app_id || null,
            secret_key: formData.cashfree_secret_key || null,
          },
          payu: {
            enabled: formData.payu_enabled,
            merchant_key: formData.payu_merchant_key || null,
            merchant_salt: formData.payu_merchant_salt || null,
          },
          paytm: {
            enabled: formData.paytm_enabled,
            merchant_id: formData.paytm_merchant_id || null,
            merchant_key: formData.paytm_merchant_key || null,
          },
          stripe: {
            enabled: formData.stripe_enabled,
            publishable_key: formData.stripe_publishable_key || null,
            secret_key: formData.stripe_secret_key || null,
          },
        },
        payment_mode: formData.payment_mode,
      };

      if (subscriptionLimits.enableCustomDomain) {
        updateData.custom_domain = formData.customDomain.trim().toLowerCase() || null;
      }

      if (subscriptionLimits.enableAiVoice) {
        updateData.ai_voice_embed_code = formData.aiVoiceEmbedCode.trim() || null;
      }

      if (subscriptionLimits.enableLocationSharing) {
        updateData.force_location_sharing = formData.forceLocationSharing;
      }

      const { error } = await supabase
        .from('stores')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update profiles table
      if (formData.phone || formData.email) {
        await supabase
          .from('profiles')
          .update({
            phone: formData.phone || null,
            email: formData.email || null,
          })
          .eq('user_id', user.id);
      }

      setAutoSaveStatus('saved');
      setLastSavedAt(new Date());

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('Auto-save error:', error);
      setAutoSaveStatus('error');
      setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 3000);
    }
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

  const handleRemoveBannerUrl = async (index: number) => {
    const bannerUrl = formData.heroBannerUrls[index];

    // Delete from VPS and media library if it's a VPS image
    if (bannerUrl.includes('digitaldukandar.in/uploads/')) {
      try {
        // 1. Delete from VPS
        await fetch('https://digitaldukandar.in/api/delete.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: bannerUrl }),
        });

        // 2. Delete from media_library table
        await supabase
          .from('media_library')
          .delete()
          .eq('file_url', bannerUrl);

        console.log('Banner image deleted from VPS and media library:', bannerUrl);
      } catch (error) {
        console.error('Failed to delete banner:', error);
      }
    }

    // Update local state
    const newBannerUrls = formData.heroBannerUrls.filter((_, i) => i !== index);
    setFormData(prev => ({
      ...prev,
      heroBannerUrls: newBannerUrls
    }));

    // Immediately save to database (don't wait for auto-save)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('stores')
          .update({ hero_banner_urls: newBannerUrls.length > 0 ? newBannerUrls : null })
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Failed to save banner changes:', error);
    }

    // Reload media library
    setTimeout(() => {
      loadMediaLibrary();
    }, 500);
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

    // Only check Google Drive connection if uploading to Drive
    if (uploadDestination === 'drive' && !googleDriveConnected) {
      toast({
        title: "Google Drive Not Connected",
        description: "Please connect your Google Drive account below to upload images directly.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    try {
      // For VPS: Compress and store locally (defer upload until save)
      if (uploadDestination === 'vps') {
        const processedFiles: File[] = [];

        for (const file of validFiles) {
          try {
            const originalSize = (file.size / 1024 / 1024).toFixed(2);
            const compressed = await compressImage(file, 5);
            const compressedSize = (compressed.size / 1024 / 1024).toFixed(2);
            console.log(`Banner compressed: ${originalSize}MB → ${compressedSize}MB`);
            processedFiles.push(compressed);
          } catch (compressError) {
            console.error('Compression failed:', compressError);
            toast({
              title: "Compression failed",
              description: `Failed to compress ${file.name}, using original`,
              variant: "destructive",
            });
            processedFiles.push(file);
          }
        }

        // Store files and create preview URLs
        setPendingBannerFiles(prev => [...prev, ...processedFiles]);

        const newPreviewUrls = processedFiles.map(file => URL.createObjectURL(file));
        setBannerPreviewUrls(prev => [...prev, ...newPreviewUrls]);

        // Add preview URLs to formData for display
        setFormData(prev => ({
          ...prev,
          heroBannerUrls: [...prev.heroBannerUrls, ...newPreviewUrls]
        }));

        toast({
          title: "Banners ready",
          description: `${processedFiles.length} banner(s) will be uploaded when you save settings`,
        });

        return;
      }

      // For Google Drive: Upload immediately (keep existing behavior)
      setIsUploadingBanner(true);
      setUploadingFiles(validFiles.map(f => ({ name: f.name, progress: 0 })));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];

        setUploadingFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, progress: 10 } : f
        ));

        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        uploadFormData.append('type', 'banners');

        const progressInterval = setInterval(() => {
          setUploadingFiles(prev => prev.map((f, idx) =>
            idx === i && f.progress < 90 ? { ...f, progress: f.progress + 10 } : f
          ));
        }, 200);

        try {
          // Google Drive upload via edge function
          const response = await supabase.functions.invoke('upload-to-drive', {
            body: uploadFormData,
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });

          clearInterval(progressInterval);

          if (response.error) {
            setUploadingFiles(prev => prev.filter((_, idx) => idx !== i));
            throw new Error(response.error.message || 'Failed to upload image');
          }

          if (response.data?.imageUrl) {
            setUploadingFiles(prev => prev.map((f, idx) =>
              idx === i ? { ...f, progress: 100 } : f
            ));

            await new Promise(resolve => setTimeout(resolve, 300));

            setUploadingFiles(prev => prev.filter((_, idx) => idx !== i));
            setFormData(prev => ({
              ...prev,
              heroBannerUrls: [...prev.heroBannerUrls, response.data.imageUrl]
            }));

            toast({
              title: "Banner Uploaded",
              description: `${file.name} uploaded successfully`,
            });
          }
        } catch (fileError) {
          clearInterval(progressInterval);
          throw fileError;
        }
      }

      // Reload media library and storage stats
      loadMediaLibrary();
      loadSettings();
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

      if (errorMessage.toLowerCase().includes('storage limit')) {
        toast({
          title: "Storage Limit Reached",
          description: errorMessage,
          variant: "destructive",
          duration: 6000,
        });
      } else if (errorMessage.toLowerCase().includes('drive') &&
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
      setUploadingFiles([]);
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

      // Upload pending banner files (VPS only) before saving settings
      if (pendingBannerFiles.length > 0 && uploadDestination === 'vps') {
        try {
          // Get store info
          const { data: store, error: storeError } = await supabase
            .from('stores')
            .select('id, storage_used_mb, storage_limit_mb')
            .eq('user_id', user.id)
            .single();

          if (storeError) throw storeError;
          if (!store) throw new Error('Store not found');

          const currentUsage = store.storage_used_mb || 0;
          const storageLimit = store.storage_limit_mb || 100;

          // Calculate total size of pending files
          const totalPendingSize = pendingBannerFiles.reduce((sum, file) => sum + (file.size / 1024 / 1024), 0);

          // Check storage limit
          if (currentUsage + totalPendingSize > storageLimit) {
            toast({
              variant: "destructive",
              title: "Storage Limit Exceeded",
              description: `Cannot upload banners. You need ${(totalPendingSize).toFixed(2)}MB but only have ${(storageLimit - currentUsage).toFixed(2)}MB available. Delete some images from Media Library to free up space.`,
            });
            setIsLoading(false);
            return;
          }

          // Upload each pending banner file
          const uploadedUrls: string[] = [];
          let totalUploadedSize = 0;

          for (let i = 0; i < pendingBannerFiles.length; i++) {
            const file = pendingBannerFiles[i];
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'banners');

            const uploadResponse = await fetch('https://digitaldukandar.in/api/upload.php', {
              method: 'POST',
              body: formData,
            });

            if (!uploadResponse.ok) {
              const errorText = await uploadResponse.text();
              throw new Error(`Upload failed: ${errorText}`);
            }

            const responseData = await uploadResponse.json();
            if (!responseData.success) {
              throw new Error(responseData.error || 'Upload failed');
            }

            const imageUrl = responseData.imageUrl;
            const fileSizeMB = file.size / 1024 / 1024;

            // Track in media_library
            const { error: mediaError } = await supabase
              .from('media_library')
              .insert({
                store_id: store.id,
                file_url: imageUrl,
                file_name: file.name,
                file_size_mb: fileSizeMB,
                file_type: 'banners',
              });

            if (mediaError) {
              console.error('Error tracking banner in media library:', mediaError);
            }

            // Update storage usage incrementally
            const newUsage = currentUsage + totalUploadedSize + fileSizeMB;
            const { error: storageError } = await supabase
              .from('stores')
              .update({ storage_used_mb: newUsage })
              .eq('id', store.id);

            if (storageError) {
              console.error('Error updating storage usage:', storageError);
            }

            uploadedUrls.push(imageUrl);
            totalUploadedSize += fileSizeMB;
          }

          // Replace blob URLs with actual uploaded URLs in formData
          // Find and replace all blob URLs with their corresponding uploaded URLs
          const updatedBannerUrls = formData.heroBannerUrls.map(url => {
            const blobIndex = bannerPreviewUrls.indexOf(url);
            if (blobIndex !== -1 && blobIndex < uploadedUrls.length) {
              return uploadedUrls[blobIndex];
            }
            return url;
          });

          // Update formData with actual uploaded URLs
          formData.heroBannerUrls = updatedBannerUrls;

          // Clean up blob URLs
          bannerPreviewUrls.forEach(url => {
            if (url.startsWith('blob:')) {
              URL.revokeObjectURL(url);
            }
          });

          // Clear pending files and preview URLs
          setPendingBannerFiles([]);
          setBannerPreviewUrls([]);

          toast({
            title: "Banners Uploaded",
            description: `Successfully uploaded ${uploadedUrls.length} banner(s) (${totalUploadedSize.toFixed(2)}MB)`,
          });
        } catch (uploadError) {
          console.error('Error uploading pending banners:', uploadError);
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: uploadError instanceof Error ? uploadError.message : "Failed to upload banner images",
          });
          setIsLoading(false);
          return;
        }
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
        },
        payment_gateway_credentials: {
          razorpay: {
            enabled: formData.razorpay_enabled,
            key_id: formData.razorpay_key_id || null,
            key_secret: formData.razorpay_key_secret || null,
          },
          phonepe: {
            enabled: formData.phonepe_enabled,
            merchant_id: formData.phonepe_merchant_id || null,
            salt_key: formData.phonepe_salt_key || null,
            salt_index: formData.phonepe_salt_index || null,
          },
          cashfree: {
            enabled: formData.cashfree_enabled,
            app_id: formData.cashfree_app_id || null,
            secret_key: formData.cashfree_secret_key || null,
          },
          payu: {
            enabled: formData.payu_enabled,
            merchant_key: formData.payu_merchant_key || null,
            merchant_salt: formData.payu_merchant_salt || null,
          },
          paytm: {
            enabled: formData.paytm_enabled,
            merchant_id: formData.paytm_merchant_id || null,
            merchant_key: formData.paytm_merchant_key || null,
          },
          stripe: {
            enabled: formData.stripe_enabled,
            publishable_key: formData.stripe_publishable_key || null,
            secret_key: formData.stripe_secret_key || null,
          },
        },
        payment_mode: formData.payment_mode,
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
        .eq('user_id', user.id)
        .select();

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
      
      // Update auto-save status
      setAutoSaveStatus('saved');
      setLastSavedAt(new Date());

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
    <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Store Settings</h1>
            <p className="text-muted-foreground mt-1">
              Configure your store information and policies
            </p>
          </div>

          {/* Auto-save Status Indicator */}
          <div className="flex items-center gap-2 text-sm">
            {autoSaveStatus === 'saving' && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
            {autoSaveStatus === 'saved' && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Saved{lastSavedAt && ` at ${lastSavedAt.toLocaleTimeString()}`}</span>
              </div>
            )}
            {autoSaveStatus === 'error' && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Save failed</span>
              </div>
            )}
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

          {/* Payment Gateway Configuration Section */}
          <Card className="admin-card">
            <Collapsible>
              <CardHeader>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between w-full">
                    <CardTitle className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <CreditCard className="w-5 h-5 text-primary" />
                      </div>
                      Payment Gateway Configuration
                    </CardTitle>
                    <ChevronDown className="h-5 w-5 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </div>
                </CollapsibleTrigger>
                <p className="text-muted-foreground mt-2 text-left">Configure payment gateways for your store - click any card to set up</p>
              </CardHeader>

              <CollapsibleContent>
                <CardContent className="space-y-6">
              <Alert>
                <CreditCard className="h-4 w-4" />
                <AlertDescription>
                  Click on any payment gateway card below to configure credentials. Payments go directly to your account.
                </AlertDescription>
              </Alert>

              {/* Payment Mode Selector - Only show when at least one gateway is enabled */}
              {(formData.razorpay_enabled || formData.phonepe_enabled || formData.cashfree_enabled ||
                formData.payu_enabled || formData.paytm_enabled || formData.stripe_enabled) && (
                <div className="p-6 rounded-xl border-2 border-primary/20 bg-primary/5">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold mb-1">Payment Methods at Checkout</h3>
                      <p className="text-sm text-muted-foreground">
                        Choose which payment options customers will see during checkout
                      </p>
                    </div>

                    {/* Segmented Switch Buttons */}
                    <div className="inline-flex rounded-lg border-2 border-primary/20 p-1 bg-background">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, payment_mode: 'online_only' }))}
                        className={`px-6 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                          formData.payment_mode === 'online_only'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        💳 Online Payment Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, payment_mode: 'online_and_cod' }))}
                        className={`px-6 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                          formData.payment_mode === 'online_and_cod'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        💳💵 Online + COD
                      </button>
                    </div>

                    {/* Description based on selected mode */}
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                      <div className="mt-0.5">
                        {formData.payment_mode === 'online_only' ? (
                          <AlertTriangle className="w-4 h-4 text-blue-600" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formData.payment_mode === 'online_only' ? (
                          <>
                            <strong>Online Payment Only:</strong> Customers can only pay using configured payment gateways.
                            Cash on Delivery will not be available.
                          </>
                        ) : (
                          <>
                            <strong>Online + COD:</strong> Customers can choose to pay online or via Cash on Delivery.
                            This gives maximum flexibility to your customers.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Show COD-only message when no gateways configured */}
              {!(formData.razorpay_enabled || formData.phonepe_enabled || formData.cashfree_enabled ||
                formData.payu_enabled || formData.paytm_enabled || formData.stripe_enabled) && (
                <Alert className="bg-amber-500/10 border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-900 dark:text-amber-100">
                    <strong>Cash on Delivery Only:</strong> Configure at least one payment gateway below to enable online payments.
                  </AlertDescription>
                </Alert>
              )}

              {/* Payment Gateway Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* Razorpay Card */}
                <div
                  onClick={() => setOpenGatewayDialog('razorpay')}
                  className="relative group cursor-pointer border-2 rounded-xl p-6 transition-all hover:shadow-lg hover:border-blue-500/50 hover:-translate-y-1"
                  style={{ borderColor: formData.razorpay_enabled ? '#3b82f6' : 'transparent' }}
                >
                  <div className="absolute top-4 right-4">
                    {formData.razorpay_enabled ? (
                      <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2.5 py-1 rounded-full font-medium">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Active
                      </span>
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-medium">
                        Not configured
                      </span>
                    )}
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                      <CreditCard className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">Razorpay</h3>
                      <p className="text-sm text-muted-foreground mb-3">Popular in India</p>
                      <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                        <SettingsIcon className="w-3.5 h-3.5" />
                        Click to configure
                      </div>
                    </div>
                  </div>
                </div>

                {/* PhonePe Card */}
                <div
                  onClick={() => setOpenGatewayDialog('phonepe')}
                  className="relative group cursor-pointer border-2 rounded-xl p-6 transition-all hover:shadow-lg hover:border-purple-500/50 hover:-translate-y-1"
                  style={{ borderColor: formData.phonepe_enabled ? '#a855f7' : 'transparent' }}
                >
                  <div className="absolute top-4 right-4">
                    {formData.phonepe_enabled ? (
                      <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2.5 py-1 rounded-full font-medium">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Active
                      </span>
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-medium">
                        Not configured
                      </span>
                    )}
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                      <CreditCard className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">PhonePe</h3>
                      <p className="text-sm text-muted-foreground mb-3">UPI & Digital</p>
                      <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 font-medium">
                        <SettingsIcon className="w-3.5 h-3.5" />
                        Click to configure
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cashfree Card */}
                <div
                  onClick={() => setOpenGatewayDialog('cashfree')}
                  className="relative group cursor-pointer border-2 rounded-xl p-6 transition-all hover:shadow-lg hover:border-green-500/50 hover:-translate-y-1"
                  style={{ borderColor: formData.cashfree_enabled ? '#22c55e' : 'transparent' }}
                >
                  <div className="absolute top-4 right-4">
                    {formData.cashfree_enabled ? (
                      <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2.5 py-1 rounded-full font-medium">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Active
                      </span>
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-medium">
                        Not configured
                      </span>
                    )}
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                      <CreditCard className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">Cashfree</h3>
                      <p className="text-sm text-muted-foreground mb-3">Payments & Payouts</p>
                      <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 font-medium">
                        <SettingsIcon className="w-3.5 h-3.5" />
                        Click to configure
                      </div>
                    </div>
                  </div>
                </div>

                {/* PayU Card */}
                <div
                  onClick={() => setOpenGatewayDialog('payu')}
                  className="relative group cursor-pointer border-2 rounded-xl p-6 transition-all hover:shadow-lg hover:border-orange-500/50 hover:-translate-y-1"
                  style={{ borderColor: formData.payu_enabled ? '#f97316' : 'transparent' }}
                >
                  <div className="absolute top-4 right-4">
                    {formData.payu_enabled ? (
                      <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2.5 py-1 rounded-full font-medium">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Active
                      </span>
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-medium">
                        Not configured
                      </span>
                    )}
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                      <CreditCard className="w-6 h-6 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">PayU</h3>
                      <p className="text-sm text-muted-foreground mb-3">Leading Solution</p>
                      <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400 font-medium">
                        <SettingsIcon className="w-3.5 h-3.5" />
                        Click to configure
                      </div>
                    </div>
                  </div>
                </div>

                {/* Paytm Card */}
                <div
                  onClick={() => setOpenGatewayDialog('paytm')}
                  className="relative group cursor-pointer border-2 rounded-xl p-6 transition-all hover:shadow-lg hover:border-sky-500/50 hover:-translate-y-1"
                  style={{ borderColor: formData.paytm_enabled ? '#0ea5e9' : 'transparent' }}
                >
                  <div className="absolute top-4 right-4">
                    {formData.paytm_enabled ? (
                      <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2.5 py-1 rounded-full font-medium">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Active
                      </span>
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-medium">
                        Not configured
                      </span>
                    )}
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-sky-500/10 group-hover:bg-sky-500/20 transition-colors">
                      <CreditCard className="w-6 h-6 text-sky-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">Paytm</h3>
                      <p className="text-sm text-muted-foreground mb-3">Wallet & Gateway</p>
                      <div className="flex items-center gap-2 text-xs text-sky-600 dark:text-sky-400 font-medium">
                        <SettingsIcon className="w-3.5 h-3.5" />
                        Click to configure
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stripe Card */}
                <div
                  onClick={() => setOpenGatewayDialog('stripe')}
                  className="relative group cursor-pointer border-2 rounded-xl p-6 transition-all hover:shadow-lg hover:border-indigo-500/50 hover:-translate-y-1"
                  style={{ borderColor: formData.stripe_enabled ? '#6366f1' : 'transparent' }}
                >
                  <div className="absolute top-4 right-4">
                    {formData.stripe_enabled ? (
                      <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2.5 py-1 rounded-full font-medium">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Active
                      </span>
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-medium">
                        Not configured
                      </span>
                    )}
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                      <CreditCard className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">Stripe</h3>
                      <p className="text-sm text-muted-foreground mb-3">Global Platform</p>
                      <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                        <SettingsIcon className="w-3.5 h-3.5" />
                        Click to configure
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Info Alert */}
              <Alert className="bg-amber-500/5 border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-600 dark:text-amber-400">
                  <strong>Important:</strong> Keep your API credentials secure. Payments go directly to your accounts.
                  We recommend using test/sandbox credentials first before going live.
                </AlertDescription>
              </Alert>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

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
              {/* Upload Destination Selector */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Upload Destination</Label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="bannerUploadDestination"
                      value="vps"
                      checked={uploadDestination === 'vps'}
                      onChange={(e) => setUploadDestination(e.target.value as 'drive' | 'vps')}
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-sm">
                      VPS Server <span className="text-xs text-green-600 font-medium">(Recommended - Fast & Reliable)</span>
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="bannerUploadDestination"
                      value="drive"
                      checked={uploadDestination === 'drive'}
                      onChange={(e) => setUploadDestination(e.target.value as 'drive' | 'vps')}
                      className="w-4 h-4 text-primary"
                      disabled={!googleDriveConnected}
                    />
                    <span className="text-sm">
                      Google Drive {!googleDriveConnected && <span className="text-xs text-muted-foreground">(Not Connected)</span>}
                    </span>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {uploadDestination === 'vps'
                    ? 'Banners will be compressed to max 5MB and stored on your server'
                    : 'Banners will be uploaded to your connected Google Drive'}
                </p>
              </div>

              {/* Storage Usage Display (only show for VPS) */}
              {uploadDestination === 'vps' && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">VPS Storage Usage</Label>
                    <span className="text-sm font-medium">
                      {storageUsed.toFixed(2)} MB / {storageLimit} MB
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        storageUsed >= storageLimit
                          ? 'bg-destructive'
                          : storageUsed >= storageLimit * 0.8
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((storageUsed / storageLimit) * 100, 100)}%` }}
                    />
                  </div>
                  {storageUsed >= storageLimit && (
                    <p className="text-sm text-destructive font-medium flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Storage limit reached. Delete images to free space.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Limit: 20 images × 5 MB = 100 MB total
                  </p>
                </div>
              )}

              {/* Option 1: Upload from Device */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Option 1: Upload from Device</Label>
                <div className={`relative border-2 border-dashed rounded-lg overflow-hidden transition-colors ${isUploadingBanner ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}>
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
                    className={`block p-6 text-center ${isUploadingBanner ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {isUploadingBanner && uploadingFiles.length > 0 ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 text-primary animate-spin" />
                          <span className="font-medium text-foreground">
                            Uploading {uploadingFiles.length} image{uploadingFiles.length > 1 ? 's' : ''}...
                          </span>
                        </div>
                        {/* File Progress List */}
                        <div className="space-y-3 max-w-md mx-auto">
                          {uploadingFiles.map((file, index) => (
                            <div key={`uploading-${index}`} className="bg-background/80 rounded-lg p-3 border">
                              <div className="flex items-center gap-3">
                                {file.progress < 100 ? (
                                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
                                ) : (
                                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {file.progress < 100 ? 'Uploading to Google Drive...' : 'Complete!'}
                                  </p>
                                </div>
                                <span className="text-sm font-medium text-primary">{file.progress}%</span>
                              </div>
                              {/* Progress Bar */}
                              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ease-out rounded-full ${file.progress === 100 ? 'bg-green-500' : 'bg-primary'}`}
                                  style={{ width: `${file.progress}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
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
                      </div>
                    )}
                  </label>
                </div>
                {!googleDriveConnected && !isUploadingBanner && (
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

              {formData.heroBannerUrls.length === 0 && uploadingFiles.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No banner images added yet.</p>
                  <p className="text-xs mt-1">Upload images or paste URLs above to create a carousel.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Media Library Section */}
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Image className="w-5 h-5 text-primary" />
                </div>
                Media Library
              </CardTitle>
              <p className="text-muted-foreground">All VPS uploaded images</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Storage Stats */}
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Storage Usage</Label>
                  <span className="text-sm font-medium">
                    {mediaLibrary.length} images · {storageUsed.toFixed(2)} MB / {storageLimit} MB
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      storageUsed >= storageLimit
                        ? 'bg-destructive'
                        : storageUsed >= storageLimit * 0.8
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min((storageUsed / storageLimit) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Filter */}
              <div className="flex gap-2">
                <Button
                  variant={mediaFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMediaFilter('all')}
                >
                  All ({mediaLibrary.length})
                </Button>
                <Button
                  variant={mediaFilter === 'products' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMediaFilter('products')}
                >
                  Products ({mediaLibrary.filter(m => m.file_type === 'products').length})
                </Button>
                <Button
                  variant={mediaFilter === 'categories' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMediaFilter('categories')}
                >
                  Categories ({mediaLibrary.filter(m => m.file_type === 'categories').length})
                </Button>
                <Button
                  variant={mediaFilter === 'banners' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMediaFilter('banners')}
                >
                  Banners ({mediaLibrary.filter(m => m.file_type === 'banners').length})
                </Button>
              </div>

              {/* Image Grid */}
              {isLoadingMedia ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {mediaLibrary
                    .filter(media => mediaFilter === 'all' || media.file_type === mediaFilter)
                    .map((media) => (
                      <div key={media.id} className="group relative border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                        <div className="aspect-square bg-muted">
                          <img
                            src={media.file_url}
                            alt={media.file_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400';
                            }}
                          />
                        </div>
                        <div className="p-2 bg-background border-t">
                          <p className="text-xs font-medium truncate">{media.file_name}</p>
                          <p className="text-xs text-muted-foreground">{media.file_size_mb.toFixed(2)} MB</p>
                          <p className="text-xs text-muted-foreground capitalize">{media.file_type}</p>
                        </div>
                        {/* Action Buttons */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 w-8 p-0"
                            onClick={() => handleCopyImageUrl(media.file_url)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 w-8 p-0"
                            onClick={() => handleDeleteFromMediaLibrary(media.file_url)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {mediaLibrary.filter(m => mediaFilter === 'all' || m.file_type === mediaFilter).length === 0 && !isLoadingMedia && (
                <div className="text-center py-12 text-muted-foreground">
                  <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No images in media library</p>
                  <p className="text-xs mt-1">Upload images to see them here</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Google Drive Connection Section */}
          <Card className={`admin-card ${!googleDriveConnected ? 'border-red-500 border-2' : ''}`}>
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
                <Alert
                  style={{
                    animation: 'popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }}
                >
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

        {/* Payment Gateway Dialogs */}
        <Dialog open={openGatewayDialog === 'razorpay'} onOpenChange={(open) => !open && setOpenGatewayDialog(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                Configure Razorpay
              </DialogTitle>
              <DialogDescription>
                Enter your Razorpay API credentials to enable payments
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <Label className="text-base font-medium">Enable Razorpay</Label>
                <Switch
                  checked={formData.razorpay_enabled}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, razorpay_enabled: checked }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="razorpay_key_id">Key ID</Label>
                <Input
                  id="razorpay_key_id"
                  type="text"
                  placeholder="Enter your Razorpay Key ID"
                  value={formData.razorpay_key_id}
                  onChange={(e) => handleInputChange('razorpay_key_id', e.target.value)}
                  className="admin-input mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Get from Razorpay Dashboard → Settings → API Keys
                </p>
              </div>

              <div>
                <Label htmlFor="razorpay_key_secret">Key Secret</Label>
                <div className="relative mt-2">
                  <Input
                    id="razorpay_key_secret"
                    type={showSecrets.razorpay_key_secret ? "text" : "password"}
                    placeholder="••••••••••••••••••••"
                    value={formData.razorpay_key_secret}
                    onChange={(e) => handleInputChange('razorpay_key_secret', e.target.value)}
                    className="admin-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(prev => ({
                      ...prev,
                      razorpay_key_secret: !prev.razorpay_key_secret
                    }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecrets.razorpay_key_secret ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Keep this secret safe. Never share it publicly.
                </p>
              </div>

              <Alert className="bg-blue-500/5 border-blue-500/20">
                <ExternalLink className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Sign up:</strong> <a href="https://razorpay.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">razorpay.com</a> •
                  <strong className="ml-2">Docs:</strong> <a href="https://razorpay.com/docs" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">razorpay.com/docs</a>
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenGatewayDialog(null)}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setOpenGatewayDialog(null);
                  toast({
                    title: "Razorpay Updated",
                    description: "Don't forget to save your settings below",
                  });
                }}
                className="admin-button-primary"
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PhonePe Dialog */}
        <Dialog open={openGatewayDialog === 'phonepe'} onOpenChange={(open) => !open && setOpenGatewayDialog(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                </div>
                Configure PhonePe
              </DialogTitle>
              <DialogDescription>
                Enter your PhonePe credentials to enable UPI payments
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <Label className="text-base font-medium">Enable PhonePe</Label>
                <Switch
                  checked={formData.phonepe_enabled}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, phonepe_enabled: checked }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="phonepe_merchant_id">Merchant ID</Label>
                <Input
                  id="phonepe_merchant_id"
                  type="text"
                  placeholder="M123456789012345"
                  value={formData.phonepe_merchant_id}
                  onChange={(e) => handleInputChange('phonepe_merchant_id', e.target.value)}
                  className="admin-input mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Get from PhonePe Business Dashboard
                </p>
              </div>

              <div>
                <Label htmlFor="phonepe_salt_key">Salt Key</Label>
                <div className="relative mt-2">
                  <Input
                    id="phonepe_salt_key"
                    type={showSecrets.phonepe_salt_key ? "text" : "password"}
                    placeholder="••••••••••••••••••••"
                    value={formData.phonepe_salt_key}
                    onChange={(e) => handleInputChange('phonepe_salt_key', e.target.value)}
                    className="admin-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(prev => ({
                      ...prev,
                      phonepe_salt_key: !prev.phonepe_salt_key
                    }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecrets.phonepe_salt_key ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Keep this secret safe. Never share it publicly.
                </p>
              </div>

              <div>
                <Label htmlFor="phonepe_salt_index">Salt Index</Label>
                <Input
                  id="phonepe_salt_index"
                  type="text"
                  placeholder="1"
                  value={formData.phonepe_salt_index}
                  onChange={(e) => handleInputChange('phonepe_salt_index', e.target.value)}
                  className="admin-input mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Usually 1 or 2, check your PhonePe dashboard
                </p>
              </div>

              <Alert className="bg-purple-500/5 border-purple-500/20">
                <ExternalLink className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Sign up:</strong> <a href="https://business.phonepe.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-purple-600">business.phonepe.com</a> •
                  <strong className="ml-2">Docs:</strong> <a href="https://developer.phonepe.com/docs" target="_blank" rel="noopener noreferrer" className="underline hover:text-purple-600">developer.phonepe.com/docs</a>
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenGatewayDialog(null)}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setOpenGatewayDialog(null);
                  toast({
                    title: "PhonePe Updated",
                    description: "Don't forget to save your settings below",
                  });
                }}
                className="admin-button-primary"
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cashfree Dialog */}
        <Dialog open={openGatewayDialog === 'cashfree'} onOpenChange={(open) => !open && setOpenGatewayDialog(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CreditCard className="w-5 h-5 text-green-600" />
                </div>
                Configure Cashfree
              </DialogTitle>
              <DialogDescription>
                Enter your Cashfree credentials for payments & payouts
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <Label className="text-base font-medium">Enable Cashfree</Label>
                <Switch
                  checked={formData.cashfree_enabled}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, cashfree_enabled: checked }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="cashfree_app_id">App ID</Label>
                <Input
                  id="cashfree_app_id"
                  type="text"
                  placeholder="12345abcdef67890ghij"
                  value={formData.cashfree_app_id}
                  onChange={(e) => handleInputChange('cashfree_app_id', e.target.value)}
                  className="admin-input mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Get from Cashfree Dashboard → Credentials
                </p>
              </div>

              <div>
                <Label htmlFor="cashfree_secret_key">Secret Key</Label>
                <div className="relative mt-2">
                  <Input
                    id="cashfree_secret_key"
                    type={showSecrets.cashfree_secret_key ? "text" : "password"}
                    placeholder="••••••••••••••••••••"
                    value={formData.cashfree_secret_key}
                    onChange={(e) => handleInputChange('cashfree_secret_key', e.target.value)}
                    className="admin-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(prev => ({
                      ...prev,
                      cashfree_secret_key: !prev.cashfree_secret_key
                    }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecrets.cashfree_secret_key ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Keep this secret safe. Never share it publicly.
                </p>
              </div>

              <Alert className="bg-green-500/5 border-green-500/20">
                <ExternalLink className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Sign up:</strong> <a href="https://cashfree.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-green-600">cashfree.com</a> •
                  <strong className="ml-2">Docs:</strong> <a href="https://docs.cashfree.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-green-600">docs.cashfree.com</a>
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenGatewayDialog(null)}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setOpenGatewayDialog(null);
                  toast({
                    title: "Cashfree Updated",
                    description: "Don't forget to save your settings below",
                  });
                }}
                className="admin-button-primary"
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PayU Dialog */}
        <Dialog open={openGatewayDialog === 'payu'} onOpenChange={(open) => !open && setOpenGatewayDialog(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <CreditCard className="w-5 h-5 text-orange-600" />
                </div>
                Configure PayU
              </DialogTitle>
              <DialogDescription>
                Enter your PayU merchant credentials
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <Label className="text-base font-medium">Enable PayU</Label>
                <Switch
                  checked={formData.payu_enabled}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, payu_enabled: checked }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="payu_merchant_key">Merchant Key</Label>
                <Input
                  id="payu_merchant_key"
                  type="text"
                  placeholder="gtKFFx"
                  value={formData.payu_merchant_key}
                  onChange={(e) => handleInputChange('payu_merchant_key', e.target.value)}
                  className="admin-input mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Get from PayU Dashboard → Settings → API Credentials
                </p>
              </div>

              <div>
                <Label htmlFor="payu_merchant_salt">Merchant Salt</Label>
                <div className="relative mt-2">
                  <Input
                    id="payu_merchant_salt"
                    type={showSecrets.payu_merchant_salt ? "text" : "password"}
                    placeholder="••••••••••••••••••••"
                    value={formData.payu_merchant_salt}
                    onChange={(e) => handleInputChange('payu_merchant_salt', e.target.value)}
                    className="admin-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(prev => ({
                      ...prev,
                      payu_merchant_salt: !prev.payu_merchant_salt
                    }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecrets.payu_merchant_salt ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Keep this secret safe. Never share it publicly.
                </p>
              </div>

              <Alert className="bg-orange-500/5 border-orange-500/20">
                <ExternalLink className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Sign up:</strong> <a href="https://payu.in" target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-600">payu.in</a> •
                  <strong className="ml-2">Docs:</strong> <a href="https://devguide.payu.in" target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-600">devguide.payu.in</a>
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenGatewayDialog(null)}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setOpenGatewayDialog(null);
                  toast({
                    title: "PayU Updated",
                    description: "Don't forget to save your settings below",
                  });
                }}
                className="admin-button-primary"
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Paytm Dialog */}
        <Dialog open={openGatewayDialog === 'paytm'} onOpenChange={(open) => !open && setOpenGatewayDialog(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-sky-500/10">
                  <CreditCard className="w-5 h-5 text-sky-600" />
                </div>
                Configure Paytm
              </DialogTitle>
              <DialogDescription>
                Enter your Paytm merchant credentials
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <Label className="text-base font-medium">Enable Paytm</Label>
                <Switch
                  checked={formData.paytm_enabled}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, paytm_enabled: checked }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="paytm_merchant_id">Merchant ID</Label>
                <Input
                  id="paytm_merchant_id"
                  type="text"
                  placeholder="YOUR_MID_HERE"
                  value={formData.paytm_merchant_id}
                  onChange={(e) => handleInputChange('paytm_merchant_id', e.target.value)}
                  className="admin-input mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Get from Paytm Dashboard → Developer Settings
                </p>
              </div>

              <div>
                <Label htmlFor="paytm_merchant_key">Merchant Key</Label>
                <div className="relative mt-2">
                  <Input
                    id="paytm_merchant_key"
                    type={showSecrets.paytm_merchant_key ? "text" : "password"}
                    placeholder="••••••••••••••••••••"
                    value={formData.paytm_merchant_key}
                    onChange={(e) => handleInputChange('paytm_merchant_key', e.target.value)}
                    className="admin-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(prev => ({
                      ...prev,
                      paytm_merchant_key: !prev.paytm_merchant_key
                    }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecrets.paytm_merchant_key ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Keep this secret safe. Never share it publicly.
                </p>
              </div>

              <Alert className="bg-sky-500/5 border-sky-500/20">
                <ExternalLink className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Sign up:</strong> <a href="https://business.paytm.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-sky-600">business.paytm.com</a> •
                  <strong className="ml-2">Docs:</strong> <a href="https://developer.paytm.com/docs" target="_blank" rel="noopener noreferrer" className="underline hover:text-sky-600">developer.paytm.com/docs</a>
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenGatewayDialog(null)}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setOpenGatewayDialog(null);
                  toast({
                    title: "Paytm Updated",
                    description: "Don't forget to save your settings below",
                  });
                }}
                className="admin-button-primary"
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stripe Dialog */}
        <Dialog open={openGatewayDialog === 'stripe'} onOpenChange={(open) => !open && setOpenGatewayDialog(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                </div>
                Configure Stripe
              </DialogTitle>
              <DialogDescription>
                Enter your Stripe API keys for global payments
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <Label className="text-base font-medium">Enable Stripe</Label>
                <Switch
                  checked={formData.stripe_enabled}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, stripe_enabled: checked }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="stripe_publishable_key">Publishable Key</Label>
                <Input
                  id="stripe_publishable_key"
                  type="text"
                  placeholder="Enter your Stripe publishable key"
                  value={formData.stripe_publishable_key}
                  onChange={(e) => handleInputChange('stripe_publishable_key', e.target.value)}
                  className="admin-input mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Get from Stripe Dashboard → Developers → API Keys (starts with pk_)
                </p>
              </div>

              <div>
                <Label htmlFor="stripe_secret_key">Secret Key</Label>
                <div className="relative mt-2">
                  <Input
                    id="stripe_secret_key"
                    type={showSecrets.stripe_secret_key ? "text" : "password"}
                    placeholder="Enter your Stripe secret key"
                    value={formData.stripe_secret_key}
                    onChange={(e) => handleInputChange('stripe_secret_key', e.target.value)}
                    className="admin-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(prev => ({
                      ...prev,
                      stripe_secret_key: !prev.stripe_secret_key
                    }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecrets.stripe_secret_key ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Keep this secret safe. Never share it publicly. (starts with sk_)
                </p>
              </div>

              <Alert className="bg-indigo-500/5 border-indigo-500/20">
                <ExternalLink className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Sign up:</strong> <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-600">stripe.com</a> •
                  <strong className="ml-2">Docs:</strong> <a href="https://stripe.com/docs" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-600">stripe.com/docs</a>
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenGatewayDialog(null)}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setOpenGatewayDialog(null);
                  toast({
                    title: "Stripe Updated",
                    description: "Don't forget to save your settings below",
                  });
                }}
                className="admin-button-primary"
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
  );
};

export default AdminSettings;