import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Upload, X, Plus, Trash2, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getProductById, updateProduct, getProducts, type Product as SharedProduct, type Variant as SharedVariant } from "@/lib/productData";
import { supabase } from "@/integrations/supabase/client";
import { CategorySelector } from "@/components/admin/CategorySelector";
import { useSubscriptionLimits } from "@/hooks/useSubscriptionLimits";
import { compressImage, normalizeImageFormat, ALLOWED_IMAGE_TYPES } from "@/lib/imageCompression";
import { convertToDirectImageUrl } from "@/lib/imageUtils";

const variantSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "Variant name is required"),
  price: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Price must be a valid positive number"),
  offerPrice: z.string().optional(),
  sku: z.string().trim().optional(),
});

const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(100, "Name must be less than 100 characters"),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(1000, "Description must be less than 1000 characters"),
  category: z.string().min(1, "Category is required"),
  status: z.enum(["published", "draft", "inactive"]),
  variants: z.array(variantSchema).optional(),
});

type ProductFormData = z.infer<typeof productSchema>;
type Variant = z.infer<typeof variantSchema>;

const EditProduct = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [pricingMode, setPricingMode] = useState<"single" | "variants">("single");
  const [basePrice, setBasePrice] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [baseStock, setBaseStock] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [newVariant, setNewVariant] = useState({ name: "", price: "", offerPrice: "", sku: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [originalStatus, setOriginalStatus] = useState<string>("");
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<{name: string; progress: number}[]>([]);
  const [uploadDestination, setUploadDestination] = useState<'drive' | 'vps'>('vps');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editingVariant, setEditingVariant] = useState({ name: "", price: "", offerPrice: "", sku: "" });
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number } | null>(null);
  const subscriptionLimits = useSubscriptionLimits();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
category: "",
      status: "draft",
      variants: [],
    },
  });

  useEffect(() => {
    loadStoreAndProduct();
  }, [id, navigate, form]);

  const loadStoreAndProduct = async () => {
    if (!id) {
      toast({
        title: "Error",
        description: "Product ID is missing",
        variant: "destructive",
      });
      navigate("/admin/products");
      return;
    }

    const product = await getProductById(id);
    if (!product) {
      toast({
        title: "Product not found",
        description: "The product you're trying to edit doesn't exist",
        variant: "destructive",
      });
      navigate("/admin/products");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if we're returning from Google OAuth with new tokens
      const { data: { session } } = await supabase.auth.getSession();
      const providerToken = session?.provider_token;
      const providerRefreshToken = session?.provider_refresh_token;

      const { data: store, error } = await supabase
        .from("stores")
        .select("id, slug, google_access_token, google_refresh_token")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      if (store) {
        setStoreId(store.id);
        setStoreSlug(store.slug || null);

        // If we have new Google tokens and a store, save them
        if (providerToken && !store.google_access_token) {
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
      }
    } catch (error: any) {
      toast({
        title: "Error loading store",
        description: error.message,
        variant: "destructive",
      });
    }

    // Load product data
    form.reset({
      name: product.name,
      description: product.description,
      category: product.category,
      status: product.status,
    });

    setOriginalStatus(product.status);
    setImageUrls(product.images || []);
    setVideoUrl(product.videoUrl || product.video_url || "");

    // Detect pricing mode from existing data
    if (product.variants && product.variants.length > 0) {
      setPricingMode("variants");
      setVariants(product.variants.map((v, idx) => ({
        id: `${idx}`,
        name: v.name,
        price: v.price.toString(),
        offerPrice: v.offer_price ? v.offer_price.toString() : "",
        sku: v.sku,
      })));
    } else {
      setPricingMode("single");
      const existingPrice = product.basePrice || product.base_price;
      if (existingPrice) {
        setBasePrice(existingPrice.toString());
      }
      const existingOfferPrice = product.offerPrice || product.offer_price;
      if (existingOfferPrice) {
        setOfferPrice(existingOfferPrice.toString());
      }
      if (product.stock) {
        setBaseStock(product.stock.toString());
      }
    }

    setIsLoading(false);
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
        setIsDriveConnected(false);
        return;
      }

      if (data?.connected) {
        setIsDriveConnected(true);
        // Only show success toast if we just connected (when there are new tokens)
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.provider_token) {
          toast({
            title: "Google Drive Connected",
            description: "You can now upload images from your device.",
          });
        }
      } else {
        setIsDriveConnected(false);
        console.log('Drive not connected:', data?.reason);
      }
    } catch (error: any) {
      console.error('Error verifying Drive connection:', error);
      setIsDriveConnected(false);
    }
  };

  const addImageUrl = () => {
    if (!newImageUrl.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid image URL",
        variant: "destructive",
      });
      return;
    }

    // Convert Google Drive share link to direct link
    let imageUrl = newImageUrl.trim();
    if (imageUrl.includes('drive.google.com')) {
      const fileIdMatch = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
      if (fileIdMatch) {
        const fileId = fileIdMatch[1] || fileIdMatch[2];
        // Use thumbnail API which works more reliably for public images
        imageUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;

        toast({
          title: "Google Drive Link Added",
          description: "Make sure the file is set to 'Anyone with the link can view'",
        });
      }
    }

    setImageUrls(prev => [...prev, imageUrl]);
    setNewImageUrl("");
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const validFiles = files.filter(file => {
      const isValidType = ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase()) ||
        ALLOWED_IMAGE_TYPES.includes('image/' + file.name.split('.').pop()?.toLowerCase());

      if (!isValidType) {
        toast({
          title: "Unsupported image format",
          description: `${file.name} — please use JPG, PNG, WebP, or HEIC`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setIsProcessingImages(true);
    setProcessingProgress({ current: 0, total: validFiles.length });

    try {
      const processedFiles: File[] = [];

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        setProcessingProgress({ current: i + 1, total: validFiles.length });

        let normalized: File;
        try {
          normalized = await normalizeImageFormat(file);
        } catch (convertError: any) {
          toast({
            title: "Cannot process image",
            description: convertError.message || `Could not process ${file.name}. Please export as JPG from your camera app.`,
            variant: "destructive",
          });
          continue;
        }

        if (uploadDestination === 'vps') {
          try {
            const compressed = await compressImage(normalized, 1, 1200);
            processedFiles.push(compressed);
          } catch {
            processedFiles.push(normalized);
          }
        } else {
          processedFiles.push(normalized);
        }
      }

      if (processedFiles.length === 0) return;

      setPendingFiles(prev => [...prev, ...processedFiles]);
      const newPreviews = processedFiles.map(f => URL.createObjectURL(f));
      setPreviewUrls(prev => [...prev, ...newPreviews]);

      toast({
        title: "Images ready",
        description: `${processedFiles.length} image(s) will be uploaded when you save`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to process images",
        variant: "destructive",
      });
    } finally {
      setIsProcessingImages(false);
      setProcessingProgress(null);
      event.target.value = '';
    }
  };

  const removePendingFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const removeImageUrl = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const addVariant = () => {
    if (!newVariant.name.trim() || !newVariant.price.trim()) {
      toast({
        title: "Invalid variant",
        description: "Please provide variant name and price",
        variant: "destructive",
      });
      return;
    }

    const isDuplicate = variants.some(
      v => v.name.trim().toLowerCase() === newVariant.name.trim().toLowerCase()
    );
    if (isDuplicate) {
      toast({
        title: "Duplicate variant name",
        description: `A variant named "${newVariant.name.trim()}" already exists. Each variant must have a unique name.`,
        variant: "destructive",
      });
      return;
    }

    const variant: Variant = {
      id: Date.now().toString(),
      name: newVariant.name.trim(),
      price: newVariant.price,
      offerPrice: newVariant.offerPrice.trim() || undefined,
      sku: newVariant.sku.trim() || undefined,
    };

    setVariants(prev => [...prev, variant]);
    setNewVariant({ name: "", price: "", offerPrice: "", sku: "" });
  };

  const removeVariant = (variantId: string) => {
    setVariants(prev => prev.filter(v => v.id !== variantId));
  };

  const startEditVariant = (variant: Variant) => {
    setEditingVariantId(variant.id);
    setEditingVariant({ name: variant.name, price: variant.price, offerPrice: variant.offerPrice || "", sku: variant.sku || "" });
  };

  const saveEditVariant = () => {
    if (!editingVariantId || !editingVariant.name.trim() || !editingVariant.price.trim()) {
      toast({
        title: "Invalid variant",
        description: "Please provide variant name and price",
        variant: "destructive",
      });
      return;
    }

    const isDuplicate = variants.some(
      v => v.id !== editingVariantId &&
        v.name.trim().toLowerCase() === editingVariant.name.trim().toLowerCase()
    );
    if (isDuplicate) {
      toast({
        title: "Duplicate variant name",
        description: `A variant named "${editingVariant.name.trim()}" already exists. Each variant must have a unique name.`,
        variant: "destructive",
      });
      return;
    }

    setVariants(prev =>
      prev.map(v =>
        v.id === editingVariantId
          ? { ...v, name: editingVariant.name.trim(), price: editingVariant.price, offerPrice: editingVariant.offerPrice.trim() || undefined, sku: editingVariant.sku.trim() || undefined }
          : v
      )
    );

    setEditingVariantId(null);
    setEditingVariant({ name: "", price: "", offerPrice: "", sku: "" });
  };

  const cancelEditVariant = () => {
    setEditingVariantId(null);
    setEditingVariant({ name: "", price: "", offerPrice: "", sku: "" });
  };

  const getPriceRange = () => {
    if (variants.length === 0) return null;
    
    const prices = variants.map(v => parseFloat(v.price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    if (minPrice === maxPrice) {
      return `₹${minPrice.toFixed(2)}`;
    }
    return `₹${minPrice.toFixed(2)} - ₹${maxPrice.toFixed(2)}`;
  };

  const onSubmit = async (data: ProductFormData) => {
    if (!id) return;

    // Validate pricing
    if (pricingMode === "single" && (!basePrice || parseFloat(basePrice) <= 0)) {
      toast({
        title: "Price required",
        description: "Please enter a valid product price",
        variant: "destructive",
      });
      return;
    }
    if (pricingMode === "variants" && variants.length === 0) {
      toast({
        title: "Variants required",
        description: "Please add at least one variant or switch to single price",
        variant: "destructive",
      });
      return;
    }

    // Check if changing to published status when it wasn't published before
    const wasNotPublished = originalStatus !== "published";
    const isPublishingNow = data.status === "published";
    
    if (wasNotPublished && isPublishingNow && !subscriptionLimits.canPublishProduct()) {
      toast({
        title: "Product Limit Reached",
        description: subscriptionLimits.getProductLimitMessage() || "Cannot publish more products",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let uploadedImageUrls: string[] = [...imageUrls];

      if (pendingFiles.length > 0) {
        setIsUploadingToDrive(true);
        setUploadingFiles(pendingFiles.map(f => ({ name: f.name, progress: 0 })));

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not found');

        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('id, storage_used_mb, storage_limit_mb')
          .eq('user_id', user.id)
          .single();

        if (storeError || !store) throw new Error('Store not found');

        if (uploadDestination === 'vps') {
          const totalPendingSize = pendingFiles.reduce((sum, f) => sum + f.size / 1024 / 1024, 0);
          let currentUsage = store.storage_used_mb || 0;
          const storageLimit = store.storage_limit_mb || 100;

          if (currentUsage + totalPendingSize > storageLimit) {
            throw new Error(`Storage limit reached. You have ${(storageLimit - currentUsage).toFixed(2)}MB remaining.`);
          }

          for (let i = 0; i < pendingFiles.length; i++) {
            const file = pendingFiles[i];
            const fileSizeMB = file.size / 1024 / 1024;

            setUploadingFiles(prev => prev.map((f, idx) => idx === i ? { ...f, progress: 10 } : f));

            const uploadFormData = new FormData();
            uploadFormData.append('file', file);
            uploadFormData.append('type', 'products');
            if (storeSlug) uploadFormData.append('store_slug', storeSlug);

            const progressInterval = setInterval(() => {
              setUploadingFiles(prev => prev.map((f, idx) =>
                idx === i && f.progress < 90 ? { ...f, progress: f.progress + 10 } : f
              ));
            }, 200);

            try {
              const uploadResponse = await fetch('https://digitaldukandar.in/api/upload.php', {
                method: 'POST',
                body: uploadFormData,
              });
              const responseData = await uploadResponse.json();
              clearInterval(progressInterval);

              if (!uploadResponse.ok || !responseData.success) {
                throw new Error(responseData.error || 'Failed to upload image');
              }

              uploadedImageUrls.push(responseData.imageUrl);

              await supabase.from('media_library').insert({
                store_id: store.id,
                file_url: responseData.imageUrl,
                file_name: responseData.fileId || file.name,
                file_size_mb: fileSizeMB,
                file_type: 'products',
              });

              currentUsage += fileSizeMB;
              await supabase.from('stores').update({ storage_used_mb: currentUsage }).eq('id', store.id);

              setUploadingFiles(prev => prev.map((f, idx) => idx === i ? { ...f, progress: 100 } : f));
            } catch (fileError) {
              clearInterval(progressInterval);
              throw fileError;
            }
          }
        } else {
          for (let i = 0; i < pendingFiles.length; i++) {
            const file = pendingFiles[i];
            setUploadingFiles(prev => prev.map((f, idx) => idx === i ? { ...f, progress: 10 } : f));

            const uploadFormData = new FormData();
            uploadFormData.append('file', file);

            const progressInterval = setInterval(() => {
              setUploadingFiles(prev => prev.map((f, idx) =>
                idx === i && f.progress < 90 ? { ...f, progress: f.progress + 10 } : f
              ));
            }, 200);

            try {
              const response = await supabase.functions.invoke('upload-to-drive', {
                body: uploadFormData,
                headers: { 'Authorization': `Bearer ${session.access_token}` },
              });
              clearInterval(progressInterval);

              if (response.error) throw new Error(response.error.message || 'Failed to upload image');

              if (response.data?.imageUrl) {
                const productImageUrl = convertToDirectImageUrl(response.data.imageUrl) || response.data.imageUrl;
                uploadedImageUrls.push(productImageUrl);
              }

              setUploadingFiles(prev => prev.map((f, idx) => idx === i ? { ...f, progress: 100 } : f));
            } catch (fileError) {
              clearInterval(progressInterval);
              throw fileError;
            }
          }
        }

        setIsUploadingToDrive(false);
        setUploadingFiles([]);
        previewUrls.forEach(url => URL.revokeObjectURL(url));
        setPendingFiles([]);
        setPreviewUrls([]);
        setImageUrls(uploadedImageUrls);
      }

      // For variant mode: derive base_price/offer_price from the cheapest-offer variant
      // so DB columns stay consistent and the product card always shows the correct price.
      const cheapestOfferVariant = pricingMode === "variants"
        ? variants
            .filter(v => v.offerPrice && parseFloat(v.offerPrice) > 0 && parseFloat(v.offerPrice) < parseFloat(v.price))
            .reduce<typeof variants[0] | null>((best, v) =>
              !best || parseFloat(v.offerPrice!) < parseFloat(best.offerPrice!) ? v : best, null)
        : null;

      // Update product using shared utility
      const productData: SharedProduct = {
        id,
        name: data.name,
        description: data.description,
        category: data.category,
        status: data.status as 'published' | 'draft' | 'inactive',
        images: uploadedImageUrls.length > 0 ? uploadedImageUrls : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
        videoUrl: videoUrl.trim() || undefined,
        basePrice: pricingMode === "single" && basePrice
          ? parseFloat(basePrice)
          : cheapestOfferVariant
            ? parseFloat(cheapestOfferVariant.price)
            : pricingMode === "variants" && variants.length > 0
              ? Math.min(...variants.map(v => parseFloat(v.price)))
              : undefined,
        offerPrice: pricingMode === "single" && offerPrice && parseFloat(offerPrice) > 0
          ? parseFloat(offerPrice)
          : cheapestOfferVariant
            ? parseFloat(cheapestOfferVariant.offerPrice!)
            : undefined,
        stock: pricingMode === "single" && baseStock ? parseInt(baseStock) : 0,
        variants: pricingMode === "variants" ? variants.map(v => ({
          name: v.name,
          price: parseFloat(v.price),
          offer_price: v.offerPrice && parseFloat(v.offerPrice) > 0 ? parseFloat(v.offerPrice) : undefined,
          sku: v.sku,
        })) : [],
        priceRange: pricingMode === "variants" ? (getPriceRange() || undefined) : (basePrice ? `₹${parseFloat(basePrice).toFixed(2)}` : undefined),
        createdAt: (await getProductById(id))?.createdAt || (await getProductById(id))?.created_at || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await updateProduct(id, productData);

      // Mark that products need export
      localStorage.setItem('products_need_export', 'true');
      window.dispatchEvent(new Event('productChanged'));

      // Navigate to products page with highlighted product
      navigate("/admin/products", { state: { highlightedProductId: id } });
    } catch (error: any) {
      toast({
        title: "Error updating product",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsUploadingToDrive(false);
      setUploadingFiles([]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading product...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Edit Product</h1>
          <p className="text-muted-foreground mt-1">
            Update product information
          </p>
        </div>

        {/* Subscription Limit Warning */}
        {subscriptionLimits.getProductLimitMessage() && (
          <Alert variant={subscriptionLimits.canPublishProduct() ? "default" : "destructive"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{subscriptionLimits.getProductLimitMessage()}</AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Product Information */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Product Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter product name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe your product..."
                              className="min-h-[120px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <FormControl>
                            <CategorySelector
                              value={field.value}
                              onChange={field.onChange}
                              storeId={storeId}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </CardContent>
                </Card>

                {/* Pricing */}
                <Card>
                  <CardHeader>
                    <CardTitle>Pricing</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Set a single price or create multiple variants (e.g., sizes, weights, colors)
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Pricing Mode Toggle */}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={pricingMode === "single" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPricingMode("single")}
                      >
                        Single Price
                      </Button>
                      <Button
                        type="button"
                        variant={pricingMode === "variants" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPricingMode("variants")}
                      >
                        Multiple Variants
                      </Button>
                    </div>

                    {/* Single Price Mode */}
                    {pricingMode === "single" && (
                      <div className="border rounded-lg p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-sm font-medium">Selling Price (₹)</label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={basePrice}
                              onChange={(e) => setBasePrice(e.target.value)}
                              className="no-spinner"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Offer Price (₹)</label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Leave blank = no offer"
                              value={offerPrice}
                              onChange={(e) => setOfferPrice(e.target.value)}
                              className="no-spinner"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Stock</label>
                            <Input
                              type="number"
                              placeholder="0 = Unlimited"
                              value={baseStock}
                              onChange={(e) => setBaseStock(e.target.value)}
                              className="no-spinner"
                            />
                          </div>
                        </div>
                        {offerPrice && basePrice && parseFloat(offerPrice) > 0 && parseFloat(basePrice) > 0 && parseFloat(offerPrice) < parseFloat(basePrice) && (
                          <p className="text-sm text-green-600 font-medium">
                            {Math.round((parseFloat(basePrice) - parseFloat(offerPrice)) / parseFloat(basePrice) * 100)}% off badge will show on product card
                          </p>
                        )}
                      </div>
                    )}

                    {/* Multiple Variants Mode */}
                    {pricingMode === "variants" && (<>
                    <div className="border rounded-lg p-4 space-y-4">
                      <h4 className="font-medium">Add Variant</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="text-sm font-medium">Variant Name</label>
                          <Input
                            placeholder="e.g., 1 KG Pack, Size XL"
                            value={newVariant.name}
                            onChange={(e) => setNewVariant(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Selling Price (₹)</label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={newVariant.price}
                            onChange={(e) => setNewVariant(prev => ({ ...prev, price: e.target.value }))}
                            className="no-spinner"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Offer Price (₹)</label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Leave blank = no offer"
                            value={newVariant.offerPrice}
                            onChange={(e) => setNewVariant(prev => ({ ...prev, offerPrice: e.target.value }))}
                            className="no-spinner"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Stock</label>
                          <Input
                            placeholder="0 = Unlimited"
                            value={newVariant.sku}
                            onChange={(e) => setNewVariant(prev => ({ ...prev, sku: e.target.value }))}
                          />
                        </div>
                      </div>
                      <Button type="button" onClick={addVariant} size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Variant
                      </Button>
                    </div>

                    {/* Variants Preview */}
                    {variants.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Variants ({variants.length})</h4>
                          <div className="text-sm text-muted-foreground">
                            Price Range: <span className="font-medium">{getPriceRange()}</span>
                          </div>
                        </div>
                        
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Variant Name</TableHead>
                                <TableHead>Selling Price</TableHead>
                                <TableHead>Offer Price</TableHead>
                                <TableHead>Stock</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {variants.map((variant) => (
                                <TableRow key={variant.id}>
                                  {editingVariantId === variant.id ? (
                                    <>
                                      <TableCell>
                                        <Input
                                          value={editingVariant.name}
                                          onChange={(e) => setEditingVariant(prev => ({ ...prev, name: e.target.value }))}
                                          className="h-8"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={editingVariant.price}
                                          onChange={(e) => setEditingVariant(prev => ({ ...prev, price: e.target.value }))}
                                          className="h-8 no-spinner"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          placeholder="optional"
                                          value={editingVariant.offerPrice}
                                          onChange={(e) => setEditingVariant(prev => ({ ...prev, offerPrice: e.target.value }))}
                                          className="h-8 no-spinner"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          placeholder="0 = Unlimited"
                                          value={editingVariant.sku}
                                          onChange={(e) => setEditingVariant(prev => ({ ...prev, sku: e.target.value }))}
                                          className="h-8"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex gap-1">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={saveEditVariant}
                                            className="text-green-600 hover:text-green-600 h-8 px-2"
                                          >
                                            Save
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={cancelEditVariant}
                                            className="text-muted-foreground h-8 px-2"
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </>
                                  ) : (
                                    <>
                                      <TableCell className="font-medium">{variant.name}</TableCell>
                                      <TableCell>₹{parseFloat(variant.price).toFixed(2)}</TableCell>
                                      <TableCell>
                                        {variant.offerPrice && parseFloat(variant.offerPrice) > 0 ? (
                                          <span className="text-green-600 font-medium">₹{parseFloat(variant.offerPrice).toFixed(2)}</span>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">
                                        {variant.sku === "0" || variant.sku === "" ? "Unlimited" : (variant.sku || "—")}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex gap-1">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => startEditVariant(variant)}
                                            className="text-primary hover:text-primary h-8 px-2"
                                          >
                                            Edit
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeVariant(variant.id)}
                                            className="text-destructive hover:text-destructive h-8 px-2"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                    </>)}
                  </CardContent>
                </Card>

                {/* Product Images */}
                <Card>
                  <CardHeader>
                    <CardTitle>Product Images</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Upload from device or add via Google Drive URL
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Google Drive Connection Alert */}
                    <Alert
                      style={!isDriveConnected ? {
                        animation: 'popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                      } : {}}
                    >
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between gap-4">
                        {isDriveConnected ? (
                          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                            ✓ Google Drive Connected - You can now upload images from your device
                          </span>
                        ) : (
                          <>
                            <span className="text-sm font-bold text-red-600 dark:text-red-500">
                              Connect Google Drive to upload images from your device
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                setIsConnectingDrive(true);
                                try {
                                  const { error } = await supabase.auth.signInWithOAuth({
                                    provider: 'google',
                                    options: {
                                      scopes: 'https://www.googleapis.com/auth/drive.file',
                                      redirectTo: window.location.href,
                                      queryParams: {
                                        access_type: 'offline',
                                        prompt: 'consent',
                                      },
                                    },
                                  });
                                  if (error) throw error;
                                } catch (error: any) {
                                  toast({
                                    title: "Connection Failed",
                                    description: error.message,
                                    variant: "destructive",
                                  });
                                  setIsConnectingDrive(false);
                                }
                              }}
                              disabled={isConnectingDrive}
                            >
                              {isConnectingDrive ? "Connecting..." : "Connect Drive"}
                            </Button>
                          </>
                        )}
                      </AlertDescription>
                    </Alert>

                    {/* Google Drive URL Input */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium">Google Drive Image URL</label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Paste Google Drive shareable link"
                          value={newImageUrl}
                          onChange={(e) => setNewImageUrl(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addImageUrl();
                            }
                          }}
                        />
                        <Button type="button" onClick={addImageUrl} size="sm">
                          Add URL
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Make sure the link is set to "Anyone with the link can view"
                      </p>
                    </div>

                    {/* Upload Destination Selector */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium">Upload Destination</label>
                      <div className="flex gap-4">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="uploadDestinationEdit"
                            value="vps"
                            checked={uploadDestination === 'vps'}
                            onChange={(e) => setUploadDestination(e.target.value as 'drive' | 'vps')}
                            className="w-4 h-4 text-primary"
                          />
                          <span className="text-sm">VPS Server</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="uploadDestinationEdit"
                            value="drive"
                            checked={uploadDestination === 'drive'}
                            onChange={(e) => setUploadDestination(e.target.value as 'drive' | 'vps')}
                            className="w-4 h-4 text-primary"
                            disabled={!isDriveConnected}
                          />
                          <span className="text-sm">
                            Google Drive <span className="text-xs text-green-600 font-medium">(Recommended - Safe & Reliable)</span> {!isDriveConnected && <span className="text-xs text-red-500 font-medium">(Not Connected)</span>}
                          </span>
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {uploadDestination === 'vps'
                          ? 'Images will be compressed to max 5MB and stored on your server'
                          : 'Images will be uploaded to your connected Google Drive'}
                      </p>
                    </div>

                    {/* File Upload */}
                    <div className={`relative border-2 border-dashed rounded-lg overflow-hidden transition-colors ${isUploadingToDrive || isProcessingImages ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}>
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload-edit"
                        disabled={isUploadingToDrive || isProcessingImages}
                      />
                      <label
                        htmlFor="image-upload-edit"
                        className={`block p-6 text-center ${isUploadingToDrive || isProcessingImages ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {isProcessingImages ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                            <span className="text-sm font-medium text-foreground">
                              {processingProgress && processingProgress.total > 1
                                ? `Processing image ${processingProgress.current} of ${processingProgress.total}…`
                                : 'Processing image…'}
                            </span>
                          </div>
                        ) : isUploadingToDrive && uploadingFiles.length > 0 ? (
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
                                        {file.progress < 100
                                          ? `Uploading to ${uploadDestination === 'vps' ? 'VPS Server' : 'Google Drive'}...`
                                          : 'Complete!'}
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
                        ) : pendingFiles.length > 0 ? (
                          <div className="space-y-2 py-2">
                            <p className="text-sm font-medium text-foreground">{pendingFiles.length} image{pendingFiles.length > 1 ? 's' : ''} ready to upload</p>
                            <p className="text-xs text-muted-foreground">Will upload to {uploadDestination === 'vps' ? 'VPS Server' : 'Google Drive'} when you save</p>
                            <span className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 py-1">
                              Add More
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Upload from device</p>
                              <p className="text-xs text-muted-foreground">
                                {uploadDestination === 'vps'
                                  ? 'PNG, JPG images — compressed and stored on VPS'
                                  : 'PNG, JPG images — uploaded to your Google Drive'}
                              </p>
                            </div>
                            <span className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                              Choose Files
                            </span>
                          </div>
                        )}
                      </label>
                    </div>

                    {/* Pending File Previews (staged, not yet uploaded) */}
                    {previewUrls.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Pending upload ({previewUrls.length})</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {previewUrls.map((url, index) => (
                            <div key={`pending-${index}`} className="relative group">
                              <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden ring-2 ring-primary/40">
                                <img
                                  src={url}
                                  alt={`Pending ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removePendingFile(index)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                              <span className="absolute bottom-2 left-2 text-xs bg-primary text-primary-foreground rounded px-1">New</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Saved Image Previews */}
                    {imageUrls.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {imageUrls.map((url, index) => (
                          <div key={index} className="relative group">
                            <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                              <img
                                src={url}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800';
                                }}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeImageUrl(index)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Product Video */}
                <Card>
                  <CardHeader>
                    <CardTitle>Product Video</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Add a YouTube video to showcase your product
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <label className="text-sm font-medium">YouTube Video URL</label>
                      <Input
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Paste a YouTube video URL to show it alongside your product images
                      </p>
                    </div>

                    {videoUrl && (() => {
                      // Extract YouTube video ID from various URL formats
                      const getYouTubeId = (url: string) => {
                        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                        const match = url.match(regExp);
                        return (match && match[2].length === 11) ? match[2] : null;
                      };

                      const videoId = getYouTubeId(videoUrl);

                      return (
                        <div className="border rounded-lg p-2">
                          <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                          {videoId ? (
                            <div className="max-w-md mx-auto">
                              <img
                                src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                                alt="YouTube video thumbnail"
                                className="w-full h-auto rounded-lg"
                              />
                            </div>
                          ) : (
                            <div className="max-w-md mx-auto aspect-video bg-muted rounded-lg flex items-center justify-center">
                              <p className="text-sm text-muted-foreground">Invalid YouTube URL</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Product Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="published">Published</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Actions */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={isSubmitting}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {isSubmitting ? "Updating..." : "Update Product"}
                      </Button>
                      
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="w-full"
                        onClick={() => navigate("/admin/products")}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </Form>
      </div>
  );
};

export default EditProduct;
