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
import AdminLayout from "@/components/admin/AdminLayout";
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
  baseSku: z.string().trim().optional(),
  baseStock: z.string().refine((val) => {
    const num = parseInt(val);
    return !isNaN(num) && num >= 0;
  }, "Stock must be a valid number (0 or greater)"),
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
  const subscriptionLimits = useSubscriptionLimits();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
category: "",
      baseSku: "",
      baseStock: "",
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

          toast({
            title: "Google Drive Connected",
            description: "You can now upload images from your device.",
          });
          
          setIsDriveConnected(true);
        } else {
          // Treat as connected if we have any access token
          setIsDriveConnected(!!store.google_access_token);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error loading store",
        description: error.message,
        variant: "destructive",
      });
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

    setIsUploadingToDrive(true);
    setUploadingFiles(validFiles.map(f => ({ name: f.name, progress: 0 })));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      for (let i = 0; i < validFiles.length; i++) {
        let file = validFiles[i];

        setUploadingFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, progress: 10 } : f
        ));

        // Compress image if uploading to VPS
        if (uploadDestination === 'vps') {
          try {
            const originalSize = (file.size / 1024 / 1024).toFixed(2);
            file = await compressImage(file, 5);
            const compressedSize = (file.size / 1024 / 1024).toFixed(2);
            console.log(`Image compressed: ${originalSize}MB → ${compressedSize}MB`);
          } catch (compressError) {
            console.error('Compression failed:', compressError);
            toast({
              title: "Compression failed",
              description: `Failed to compress ${file.name}, uploading original`,
              variant: "destructive",
            });
          }
        }

        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        uploadFormData.append('type', 'products');

        const progressInterval = setInterval(() => {
          setUploadingFiles(prev => prev.map((f, idx) =>
            idx === i && f.progress < 90 ? { ...f, progress: f.progress + 10 } : f
          ));
        }, 200);

        try {
          const edgeFunction = uploadDestination === 'vps' ? 'upload-to-vps' : 'upload-to-drive';
          const response = await supabase.functions.invoke(edgeFunction, {
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
            setImageUrls(prev => [...prev, response.data.imageUrl]);

            const destination = uploadDestination === 'vps' ? 'VPS Server' : 'Google Drive';
            toast({
              title: "Image uploaded",
              description: `${file.name} uploaded to ${destination} successfully`,
            });
          }
        } catch (fileError) {
          clearInterval(progressInterval);
          throw fileError;
        }
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Extract error message from edge function response
      let errorMessage = error.message || '';
      if (error.context?.body) {
        try {
          const errorBody = JSON.parse(error.context.body);
          errorMessage = errorBody.error || errorBody.message || errorMessage;
        } catch (e) {
          console.error('Could not parse error body:', e);
        }
      }
      
      console.log('Extracted error message:', errorMessage);
      
      // Check if it's a Google Drive connection issue
      if (errorMessage.toLowerCase().includes('drive') && 
          errorMessage.toLowerCase().includes('not connected')) {
        toast({
          title: "Google Drive Not Connected",
          description: "Please connect your Google Drive account in Store Settings first, or use the Google Drive URL option instead.",
          variant: "destructive",
          duration: 6000,
        });
      } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('authenticated')) {
        toast({
          title: "Authentication Required",
          description: "Please sign in again to upload images.",
          variant: "destructive",
        });
      } else if (errorMessage.toLowerCase().includes('token') || errorMessage.toLowerCase().includes('expired')) {
        toast({
          title: "Google Drive Connection Expired",
          description: "Your Google Drive connection has expired. Please reconnect in Store Settings.",
          variant: "destructive",
          duration: 6000,
        });
      } else {
        // Show the actual error message from the edge function
        const description = errorMessage || 'Failed to upload to Google Drive. Try using the Google Drive URL option instead.';
        toast({
          title: "Upload Failed",
          description: description,
          variant: "destructive",
          duration: 5000,
        });
      }
    } finally {
      setIsUploadingToDrive(false);
      setUploadingFiles([]);
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
    const imageUrl = imageUrls[index];

    // Delete from VPS if it's a VPS image
    if (imageUrl.includes('digitaldukandar.in/uploads/')) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.functions.invoke('delete-from-vps', {
            body: { imageUrl },
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });
          console.log('Image deleted from VPS:', imageUrl);
        }
      } catch (error) {
        console.error('Failed to delete image from VPS:', error);
        // Don't block UI if deletion fails
      }
    }

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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Use images from URLs, or auto-assign 3 unique random images
      const allImages = imageUrls.length > 0
        ? imageUrls
        : getRandomDefaultImages(3);  // FIX: Assign 3 unique images instead of 1 hardcoded image

      // Create product using shared utility with auto-generated unique ID
      const productData: SharedProduct = {
        id: generatedProductId,
        name: data.name,
        slug: generateSlug(data.name),  // FIX: Auto-generate SEO-friendly slug from product name
        description: data.description,
        category: data.category,
stock: parseInt(data.baseStock),
        sku: data.baseSku || undefined,
        status: data.status as 'published' | 'draft' | 'inactive',
        images: allImages,  // FIX: Always use allImages (already has 3 random or uploaded)
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

      toast({
        title: "Product created successfully",
        description: `${data.name} has been added to your catalog`,
      });

      navigate("/admin/products");
    } catch (error) {
      toast({
        title: "Error creating product",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="baseSku"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Base SKU (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Product SKU (optional)" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="baseStock"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Base Stock Quantity</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="0" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
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
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">SKU (Optional)</label>
                          <Input
                            placeholder="Optional SKU"
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
                                <TableHead>SKU</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {variants.map((variant) => (
                                <TableRow key={variant.id}>
                                  <TableCell className="font-medium">{variant.name}</TableCell>
                                  <TableCell>${parseFloat(variant.price).toFixed(2)}</TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {variant.sku || "—"}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeVariant(variant.id)}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TableCell>
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
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between gap-4">
                        {isDriveConnected ? (
                          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                            ✓ Google Drive Connected - You can now upload images from your device
                          </span>
                        ) : (
                          <>
                            <span className="text-sm">
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
                            name="uploadDestination"
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
                            name="uploadDestination"
                            value="drive"
                            checked={uploadDestination === 'drive'}
                            onChange={(e) => setUploadDestination(e.target.value as 'drive' | 'vps')}
                            className="w-4 h-4 text-primary"
                            disabled={!isDriveConnected}
                          />
                          <span className="text-sm">
                            Google Drive {!isDriveConnected && <span className="text-xs text-muted-foreground">(Not Connected)</span>}
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
                    {imageUrls.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
    </AdminLayout>
  );
};

export default AddProduct;