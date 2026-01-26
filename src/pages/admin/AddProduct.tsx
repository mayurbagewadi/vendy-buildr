import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { ArrowLeft, Save, Upload, X, Plus, Trash2, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { addProduct, getProducts, type Product as SharedProduct, type Variant as SharedVariant } from "@/lib/productData";
import { generateProductId } from "@/lib/idGenerator";
import { supabase } from "@/integrations/supabase/client";
import { CategorySelector } from "@/components/admin/CategorySelector";
import { useSubscriptionLimits } from "@/hooks/useSubscriptionLimits";
import { getRandomDefaultImages } from "@/lib/defaultImages";
import { compressImage } from "@/lib/imageCompression";

// Utility function to generate URL-friendly slugs from product names
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')        // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
};

const variantSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "Variant name is required"),
  price: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Price must be a valid positive number"),
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

const AddProduct = () => {
  const navigate = useNavigate();
  const [generatedProductId] = useState(generateProductId());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [newVariant, setNewVariant] = useState({ name: "", price: "", sku: "" });
  const [storeId, setStoreId] = useState<string | null>(null);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<{name: string; progress: number}[]>([]);
  const [uploadDestination, setUploadDestination] = useState<'drive' | 'vps'>('vps');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]); // Store files until save
  const [previewUrls, setPreviewUrls] = useState<string[]>([]); // Preview URLs for display
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editingVariant, setEditingVariant] = useState({ name: "", price: "", sku: "" });
  const subscriptionLimits = useSubscriptionLimits();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
category: "",
      status: "published",  // FIX: Default to published so products are immediately visible
      variants: [],
    },
  });

  useEffect(() => {
    loadStore();
  }, []);

  const loadStore = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if we're returning from Google OAuth with new tokens
      const { data: { session } } = await supabase.auth.getSession();
      const providerToken = session?.provider_token;
      const providerRefreshToken = session?.provider_refresh_token;

      const { data: store, error } = await supabase
        .from("stores")
        .select("id, google_access_token, google_refresh_token")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      if (store) {
        setStoreId(store.id);

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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

    try {
      // Compress images if uploading to VPS
      const processedFiles: File[] = [];

      for (const file of validFiles) {
        if (uploadDestination === 'vps') {
          try {
            const originalSize = (file.size / 1024 / 1024).toFixed(2);
            const compressed = await compressImage(file, 5);
            const compressedSize = (compressed.size / 1024 / 1024).toFixed(2);
            console.log(`Image compressed: ${originalSize}MB → ${compressedSize}MB`);
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
        } else {
          processedFiles.push(file);
        }
      }

      // Store files and create preview URLs
      setPendingFiles(prev => [...prev, ...processedFiles]);

      const newPreviewUrls = processedFiles.map(file => URL.createObjectURL(file));
      setPreviewUrls(prev => [...prev, ...newPreviewUrls]);

      toast({
        title: "Images ready",
        description: `${processedFiles.length} image(s) will be uploaded when you save the product`,
      });

    } catch (error: any) {
      console.error('Error processing images:', error);
      toast({
        title: "Error",
        description: "Failed to process images",
        variant: "destructive",
      });
    } finally {
      event.target.value = '';
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

  const removeImageUrl = async (index: number) => {
    const totalManualUrls = imageUrls.length;

    // Check if this is a manual URL or a pending file
    if (index < totalManualUrls) {
      // Removing a manual URL
      const imageUrl = imageUrls[index];

      // Delete from VPS if it's a VPS image
      if (imageUrl.includes('digitaldukandar.in/uploads/')) {
        try {
          // Call VPS delete endpoint directly
          const response = await fetch('https://digitaldukandar.in/api/delete.php', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageUrl }),
          });

          const result = await response.json();
          if (result.success) {
            console.log('Image deleted from VPS:', imageUrl);
          }
        } catch (error) {
          console.error('Failed to delete image from VPS:', error);
          // Don't block UI if deletion fails
        }
      }

      setImageUrls(prev => prev.filter((_, i) => i !== index));
    } else {
      // Removing a pending file
      const previewIndex = index - totalManualUrls;

      // Revoke the preview URL
      URL.revokeObjectURL(previewUrls[previewIndex]);

      setPendingFiles(prev => prev.filter((_, i) => i !== previewIndex));
      setPreviewUrls(prev => prev.filter((_, i) => i !== previewIndex));
    }
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

    const variant: Variant = {
      id: Date.now().toString(),
      name: newVariant.name.trim(),
      price: newVariant.price,
      sku: newVariant.sku.trim() || undefined,
    };

    setVariants(prev => [...prev, variant]);
    setNewVariant({ name: "", price: "", sku: "" });
  };

  const removeVariant = (id: string) => {
    setVariants(prev => prev.filter(v => v.id !== id));
  };

  const startEditVariant = (variant: Variant) => {
    setEditingVariantId(variant.id);
    setEditingVariant({ name: variant.name, price: variant.price, sku: variant.sku || "" });
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

    setVariants(prev =>
      prev.map(v =>
        v.id === editingVariantId
          ? { ...v, name: editingVariant.name.trim(), price: editingVariant.price, sku: editingVariant.sku.trim() || undefined }
          : v
      )
    );

    setEditingVariantId(null);
    setEditingVariant({ name: "", price: "", sku: "" });
  };

  const cancelEditVariant = () => {
    setEditingVariantId(null);
    setEditingVariant({ name: "", price: "", sku: "" });
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
    // Check subscription limits before publishing
    if (data.status === "published" && !subscriptionLimits.canPublishProduct()) {
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

      // Upload pending files if any
      if (pendingFiles.length > 0) {
        setUploadingFiles(pendingFiles.map(f => ({ name: f.name, progress: 0 })));

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        // Get store info for storage tracking
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not found');

        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('id, storage_used_mb, storage_limit_mb')
          .eq('user_id', user.id)
          .single();

        if (storeError || !store) {
          throw new Error('Store not found');
        }

        // Check storage limit before uploading
        const totalPendingSize = pendingFiles.reduce((sum, f) => sum + (f.size / 1024 / 1024), 0);
        let currentUsage = store.storage_used_mb || 0;
        const storageLimit = store.storage_limit_mb || 100;

        if (currentUsage + totalPendingSize > storageLimit) {
          throw new Error(`Storage limit reached. You have ${(storageLimit - currentUsage).toFixed(2)}MB remaining. Delete images from Media Library to free space.`);
        }

        for (let i = 0; i < pendingFiles.length; i++) {
          const file = pendingFiles[i];
          const fileSizeMB = file.size / 1024 / 1024;

          setUploadingFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, progress: 10 } : f
          ));

          const uploadFormData = new FormData();
          uploadFormData.append('file', file);
          uploadFormData.append('type', 'products');

          const progressInterval = setInterval(() => {
            setUploadingFiles(prev => prev.map((f, idx) =>
              idx === i && f.progress < 90 ? { ...f, progress: f.progress + 10 } : f
            ));
          }, 200);

          try {
            let response;
            let fileName = '';
            let imageUrl = '';

            if (uploadDestination === 'vps') {
              // Direct upload to VPS
              const uploadResponse = await fetch('https://digitaldukandar.in/api/upload.php', {
                method: 'POST',
                body: uploadFormData,
              });

              const responseData = await uploadResponse.json();

              if (!uploadResponse.ok || !responseData.success) {
                throw new Error(responseData.error || 'Failed to upload image');
              }

              response = { data: responseData, error: null };
              imageUrl = responseData.imageUrl;
              fileName = responseData.fileId || file.name;

              // Track in media_library for VPS uploads
              const { error: mediaError } = await supabase
                .from('media_library')
                .insert({
                  store_id: store.id,
                  file_url: imageUrl,
                  file_name: fileName,
                  file_size_mb: fileSizeMB,
                  file_type: 'products',
                });

              if (mediaError) {
                console.error('Failed to add to media library:', mediaError);
              }

              // Update storage usage
              currentUsage += fileSizeMB;
              const { error: updateError } = await supabase
                .from('stores')
                .update({ storage_used_mb: currentUsage })
                .eq('id', store.id);

              if (updateError) {
                console.error('Failed to update storage usage:', updateError);
              }

            } else {
              // Google Drive upload via edge function (already handles tracking)
              response = await supabase.functions.invoke('upload-to-drive', {
                body: uploadFormData,
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                },
              });
            }

            clearInterval(progressInterval);

            if (response.error) {
              throw new Error(response.error.message || 'Failed to upload image');
            }

            if (response.data?.imageUrl) {
              setUploadingFiles(prev => prev.map((f, idx) =>
                idx === i ? { ...f, progress: 100 } : f
              ));
              uploadedImageUrls.push(response.data.imageUrl);
            }
          } catch (fileError) {
            clearInterval(progressInterval);
            throw fileError;
          }
        }

        setUploadingFiles([]);
      }

      // Use uploaded images or auto-assign 3 unique random images
      const allImages = uploadedImageUrls.length > 0
        ? uploadedImageUrls
        : getRandomDefaultImages(3);

      // Create product using shared utility with auto-generated unique ID
      const productData: SharedProduct = {
        id: generatedProductId,
        name: data.name,
        slug: generateSlug(data.name),
        description: data.description,
        category: data.category,
        status: data.status as 'published' | 'draft' | 'inactive',
        images: allImages,
        videoUrl: videoUrl.trim() || undefined,
        variants: variants.map(v => ({
          name: v.name,
          price: parseFloat(v.price),
          sku: v.sku,
        })),
        priceRange: getPriceRange() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Use shared utility to add product
      addProduct(productData);

      // Cleanup preview URLs
      previewUrls.forEach(url => URL.revokeObjectURL(url));

      toast({
        title: "Product created successfully",
        description: `${data.name} has been added to your catalog`,
      });

      navigate("/admin/products");
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast({
        title: "Error creating product",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setUploadingFiles([]);
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Add New Product</h1>
          <p className="text-sm lg:text-base text-muted-foreground mt-1">
            Create a new product listing for your store
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 lg:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
              {/* Main Product Information */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Product Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Product ID Display */}
                    <div className="space-y-2">
                      <FormLabel className="text-muted-foreground">Product ID (Auto-generated)</FormLabel>
                      <div className="px-3 py-2 bg-muted rounded-md font-mono text-sm text-foreground">
                        {generatedProductId}
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                id="product-name"
                                className="peer h-14 pt-4 px-3"
                                placeholder=" "
                              />
                              <label
                                htmlFor="product-name"
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground bg-background px-1 transition-all duration-200 pointer-events-none peer-focus:-top-0 peer-focus:text-xs peer-focus:text-primary peer-focus:font-semibold peer-[:not(:placeholder-shown)]:-top-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-semibold"
                              >
                                Product Name
                              </label>
                            </div>
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
                          <FormControl>
                            <div className="relative">
                              <Textarea
                                {...field}
                                id="product-description"
                                placeholder=" "
                                className="peer min-h-[120px] pt-6 px-3"
                              />
                              <label
                                htmlFor="product-description"
                                className="absolute left-3 top-4 text-muted-foreground bg-background px-1 transition-all duration-200 pointer-events-none peer-focus:-top-0 peer-focus:text-xs peer-focus:text-primary peer-focus:font-semibold peer-[:not(:placeholder-shown)]:-top-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-semibold"
                              >
                                Description
                              </label>
                            </div>
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

                {/* Product Variants */}
                <Card>
                  <CardHeader>
                    <CardTitle>Product Variants</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Create different variations of your product (e.g., sizes, weights, colors)
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add New Variant */}
                    <div className="border rounded-lg p-4 space-y-4">
                      <h4 className="font-medium">Add Variant</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm font-medium">Variant Name</label>
                          <Input
                            placeholder="e.g., 1 KG Pack, Size XL"
                            value={newVariant.name}
                            onChange={(e) => setNewVariant(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Price (₹)</label>
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
                                <TableHead>Price</TableHead>
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
                                      <TableCell>${parseFloat(variant.price).toFixed(2)}</TableCell>
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
                  </CardContent>
                </Card>

                {/* Product Images */}
                <Card>
                  <CardHeader>
                    <CardTitle>Product Images</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Add images from Google Drive or upload from your device
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
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="google-drive-url"
                            placeholder=" "
                            value={newImageUrl}
                            onChange={(e) => setNewImageUrl(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addImageUrl();
                              }
                            }}
                            className="peer h-14 pt-4 px-3"
                          />
                          <label
                            htmlFor="google-drive-url"
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground bg-background px-1 transition-all duration-200 pointer-events-none peer-focus:-top-0 peer-focus:text-xs peer-focus:text-primary peer-focus:font-semibold peer-[:not(:placeholder-shown)]:-top-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-semibold"
                          >
                            Google Drive Image URL
                          </label>
                        </div>
                        <Button type="button" onClick={addImageUrl} size="sm" className="h-14">
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
                            name="uploadDestination"
                            value="vps"
                            checked={uploadDestination === 'vps'}
                            onChange={(e) => setUploadDestination(e.target.value as 'drive' | 'vps')}
                            className="w-4 h-4 text-primary"
                          />
                          <span className="text-sm">
                            VPS Server
                          </span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="uploadDestination"
                            value="drive"
                            checked={uploadDestination === 'drive'}
                            onChange={(e) => setUploadDestination(e.target.value as 'drive' | 'vps')}
                            className="w-4 h-4 text-primary"
                            disabled={!isDriveConnected}
                          />
                          <span className="text-sm">
                            Google Drive <span className="text-xs text-green-600 font-medium">(Recommended - Safe & Reliable)</span> {!isDriveConnected && <span className="text-xs text-muted-foreground">(Not Connected)</span>}
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
                    <div className={`relative border-2 border-dashed rounded-lg overflow-hidden transition-colors ${isUploadingToDrive ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                        disabled={isUploadingToDrive}
                      />
                      <label
                        htmlFor="image-upload"
                        className={`block p-6 text-center ${isUploadingToDrive ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {isUploadingToDrive && uploadingFiles.length > 0 ? (
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
                        ) : (
                          <div className="space-y-4">
                            <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Or upload from device</p>
                              <p className="text-xs text-muted-foreground">
                                {uploadDestination === 'vps'
                                  ? 'PNG, JPG images. Auto-compressed to max 5MB and stored on VPS.'
                                  : 'PNG, JPG images. Will be uploaded to your Google Drive.'}
                              </p>
                            </div>
                            <span className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                              Choose Files
                            </span>
                          </div>
                        )}
                      </label>
                    </div>

                    {/* Image Previews */}
                    {(imageUrls.length > 0 || previewUrls.length > 0) && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {/* Display manual URLs */}
                        {imageUrls.map((url, index) => (
                          <div key={`url-${index}`} className="relative group">
                            <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                              <img
                                src={url}
                                alt={`Product Image ${index + 1}`}
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
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              Image {index + 1}
                            </p>
                          </div>
                        ))}

                        {/* Display pending file previews */}
                        {previewUrls.map((url, index) => (
                          <div key={`preview-${index}`} className="relative group">
                            <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-primary/50">
                              <img
                                src={url}
                                alt={`Pending Image ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeImageUrl(imageUrls.length + index)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              Pending {index + 1} (will upload on save)
                            </p>
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
                      <div className="relative">
                        <Input
                          id="youtube-video-url"
                          placeholder=" "
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          className="peer h-14 pt-4 px-3"
                        />
                        <label
                          htmlFor="youtube-video-url"
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground bg-background px-1 transition-all duration-200 pointer-events-none peer-focus:-top-0 peer-focus:text-xs peer-focus:text-primary peer-focus:font-semibold peer-[:not(:placeholder-shown)]:-top-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-semibold"
                        >
                          YouTube Video URL
                        </label>
                      </div>
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        {isSubmitting ? "Creating..." : "Create Product"}
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

export default AddProduct;