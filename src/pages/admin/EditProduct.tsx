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
import { ArrowLeft, Save, Upload, X, Plus, Trash2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AdminLayout from "@/components/admin/AdminLayout";
import { getProductById, updateProduct, getProducts, type Product as SharedProduct, type Variant as SharedVariant } from "@/lib/productData";
import { supabase } from "@/integrations/supabase/client";
import { CategorySelector } from "@/components/admin/CategorySelector";
import { useSubscriptionLimits } from "@/hooks/useSubscriptionLimits";

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
  basePrice: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Base price must be a valid positive number"),
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

const EditProduct = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [newVariant, setNewVariant] = useState({ name: "", price: "", sku: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [originalStatus, setOriginalStatus] = useState<string>("");
  const subscriptionLimits = useSubscriptionLimits();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      basePrice: "",
      category: "",
      baseSku: "",
      baseStock: "",
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

      const { data: store, error } = await supabase
        .from("stores")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      if (store) setStoreId(store.id);
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
      basePrice: product.basePrice?.toString() || product.base_price?.toString() || "",
      baseSku: product.sku || "",
      baseStock: product.stock?.toString() || "",
      status: product.status,
    });

    setOriginalStatus(product.status);
    setImageUrls(product.images || []);
    setVideoUrl(product.videoUrl || product.video_url || "");
    
    if (product.variants) {
      setVariants(product.variants.map((v, idx) => ({
        id: `${idx}`,
        name: v.name,
        price: v.price.toString(),
        sku: v.sku,
      })));
    }

    setIsLoading(false);
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

    if (imageUrls.length >= 5) {
      toast({
        title: "Too many images",
        description: "Maximum 5 images allowed per product",
        variant: "destructive",
      });
      return;
    }

    setImageUrls(prev => [...prev, imageUrl]);
    setNewImageUrl("");
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

    const variant: Variant = {
      id: Date.now().toString(),
      name: newVariant.name.trim(),
      price: newVariant.price,
      sku: newVariant.sku.trim() || undefined,
    };

    setVariants(prev => [...prev, variant]);
    setNewVariant({ name: "", price: "", sku: "" });
  };

  const removeVariant = (variantId: string) => {
    setVariants(prev => prev.filter(v => v.id !== variantId));
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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update product using shared utility
      const productData: SharedProduct = {
        id,
        name: data.name,
        description: data.description,
        category: data.category,
        basePrice: parseFloat(data.basePrice),
        stock: parseInt(data.baseStock),
        sku: data.baseSku || undefined,
        status: data.status as 'published' | 'draft' | 'inactive',
        images: imageUrls.length > 0 ? imageUrls : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
        videoUrl: videoUrl.trim() || undefined,
        variants: variants.map(v => ({
          name: v.name,
          price: parseFloat(v.price),
          sku: v.sku,
        })),
        priceRange: getPriceRange() || `₹${parseFloat(data.basePrice).toFixed(2)}`,
        createdAt: (await getProductById(id))?.createdAt || (await getProductById(id))?.created_at || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await updateProduct(id, productData);

      toast({
        title: "Product updated successfully",
        description: `${data.name} has been updated`,
      });

      navigate("/admin/products");
    } catch (error) {
      toast({
        title: "Error updating product",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading product...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin/products")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Products
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Edit Product</h1>
              <p className="text-muted-foreground mt-1">
                Update product information
              </p>
            </div>
          </div>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="basePrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Base Price (₹)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01"
                                placeholder="0.00" 
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
                    </div>

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
                      Add images from Google Drive
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
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

                    {/* Image Previews */}
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

                    {videoUrl && (
                      <div className="border rounded-lg p-2">
                        <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                          <p className="text-sm text-muted-foreground">Video will appear here</p>
                        </div>
                      </div>
                    )}
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
    </AdminLayout>
  );
};

export default EditProduct;
