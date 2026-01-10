import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Loader2, Pencil, Upload, CheckCircle2, X, Package, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { convertToDirectImageUrl } from "@/lib/imageUtils";
import { DEMO_CATEGORIES } from "@/lib/demoProducts";
import { getRandomDefaultImage } from "@/lib/defaultImages";
import { compressImage } from "@/lib/imageCompression";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Category {
  id: string;
  name: string;
  store_id: string;
  created_at: string;
  image_url?: string | null;
}

interface EditingCategory extends Category {
  newName: string;
  newImageUrl: string;
}

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryImage, setNewCategoryImage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [editingCategory, setEditingCategory] = useState<EditingCategory | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<{name: string; progress: number}[]>([]);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [uploadDestination, setUploadDestination] = useState<'drive' | 'vps'>('vps');
  const [nameError, setNameError] = useState<string>("");

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: store } = await supabase
        .from("stores")
        .select("id, google_access_token")
        .eq("user_id", user.id)
        .single();

      if (!store) return;
      setStoreId(store.id);
      setIsDriveConnected(!!store.google_access_token);

      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("store_id", store.id)
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCategory = async () => {
    // Validate category name
    if (!newCategoryName.trim()) {
      setNameError("Category name is required");
      // Focus the input field
      document.getElementById('categoryName')?.focus();
      return;
    }

    // Clear any previous errors
    setNameError("");

    if (!storeId) {
      toast({
        title: "Error",
        description: "Store not found",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAdding(true);

      // If no image URL provided, assign a random default image
      let finalImageUrl = newCategoryImage.trim();
      if (!finalImageUrl) {
        // Use a random image from the default images pool
        finalImageUrl = getRandomDefaultImage();
      }

      const { error } = await supabase
        .from("categories")
        .insert([{
          name: newCategoryName.trim(),
          store_id: storeId,
          image_url: finalImageUrl
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Category added successfully",
      });
      setNewCategoryName("");
      setNewCategoryImage("");
      setNameError("");
      loadCategories();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;

    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", categoryToDelete.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
      loadCategories();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCategoryToDelete(null);
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory({
      ...category,
      newName: category.name,
      newImageUrl: category.image_url || "",
    });
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;

    if (!editingCategory.newName.trim()) {
      toast({
        title: "Error",
        description: "Category name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUpdating(true);

      const { error } = await supabase
        .from("categories")
        .update({
          name: editingCategory.newName.trim(),
          image_url: editingCategory.newImageUrl.trim() || null,
        })
        .eq("id", editingCategory.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Category updated successfully",
      });
      setEditingCategory(null);
      loadCategories();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConvertAndSetUrl = (url: string, isEditMode: boolean) => {
    if (!url.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid image URL",
        variant: "destructive",
      });
      return;
    }

    // Convert Google Drive share link to direct link
    let imageUrl = url.trim();
    if (imageUrl.includes('drive.google.com')) {
      const fileIdMatch = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
      if (fileIdMatch) {
        const fileId = fileIdMatch[1] || fileIdMatch[2];
        // Use thumbnail API which works more reliably for public images
        imageUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;

        toast({
          title: "✓ Google Drive Link Converted",
          description: "URL converted to direct image format. Preview shown below.",
        });
      }
    }

    if (isEditMode && editingCategory) {
      setEditingCategory(prev => prev ? { ...prev, newImageUrl: imageUrl } : null);
    } else {
      setNewCategoryImage(imageUrl);
      // Scroll to preview
      setTimeout(() => {
        const previewElement = document.querySelector('[data-image-preview]');
        if (previewElement) {
          previewElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, isEditMode: boolean = false) => {
    let file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: `${file.name} is not a valid image file`,
        variant: "destructive",
      });
      return;
    }

    setIsUploadingImage(true);
    setUploadingFiles([{ name: file.name, progress: 0 }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Start progress simulation
      setUploadingFiles([{ name: file.name, progress: 10 }]);

      // Compress image if uploading to VPS
      if (uploadDestination === 'vps') {
        try {
          const originalSize = (file.size / 1024 / 1024).toFixed(2);
          file = await compressImage(file, 5);
          const compressedSize = (file.size / 1024 / 1024).toFixed(2);
          console.log(`Image compressed: ${originalSize}MB → ${compressedSize}MB`);
        } catch (compressError) {
          console.error('Compression failed:', compressError);
        }
      }

      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('type', 'categories');

      const progressInterval = setInterval(() => {
        setUploadingFiles(prev =>
          prev.map(f => f.progress < 90 ? { ...f, progress: f.progress + 10 } : f)
        );
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
          throw new Error(response.error.message || 'Failed to upload image');
        }

        if (response.data?.imageUrl) {
          setUploadingFiles([{ name: file.name, progress: 100 }]);
          await new Promise(resolve => setTimeout(resolve, 500));

          if (isEditMode && editingCategory) {
            setEditingCategory(prev => prev ? { ...prev, newImageUrl: response.data.imageUrl } : null);
          } else {
            setNewCategoryImage(response.data.imageUrl);
            // Scroll to preview after a short delay
            setTimeout(() => {
              const previewElement = document.querySelector('[data-image-preview]');
              if (previewElement) {
                previewElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }, 100);
          }

          toast({
            title: "✓ Image uploaded successfully!",
            description: `${file.name} is ready to use. Preview shown below.`,
          });
        }
      } catch (fileError) {
        clearInterval(progressInterval);
        throw fileError;
      }
    } catch (error: any) {
      console.error('Upload error:', error);

      let errorMessage = error.message || '';
      if (error.context?.body) {
        try {
          const errorBody = JSON.parse(error.context.body);
          errorMessage = errorBody.error || errorBody.message || errorMessage;
        } catch (e) {
          console.error('Could not parse error body:', e);
        }
      }

      if (errorMessage.toLowerCase().includes('drive') &&
          errorMessage.toLowerCase().includes('not connected')) {
        toast({
          title: "Google Drive Not Connected",
          description: "Please connect your Google Drive account in Store Settings first.",
          variant: "destructive",
          duration: 6000,
        });
      } else if (errorMessage.toLowerCase().includes('token') || errorMessage.toLowerCase().includes('expired')) {
        toast({
          title: "Google Drive Connection Expired",
          description: "Your Google Drive connection has expired. Please reconnect in Store Settings.",
          variant: "destructive",
          duration: 6000,
        });
      } else {
        toast({
          title: "Upload Failed",
          description: errorMessage || 'Failed to upload to Google Drive. Try using the Google Drive URL option instead.',
          variant: "destructive",
          duration: 5000,
        });
      }
    } finally {
      setIsUploadingImage(false);
      setUploadingFiles([]);
      event.target.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Category Form */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="categoryName" className="text-base font-medium">
              Category Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="categoryName"
              placeholder="Enter category name..."
              value={newCategoryName}
              onChange={(e) => {
                setNewCategoryName(e.target.value);
                // Clear error when user starts typing
                if (nameError) setNameError("");
              }}
              onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleAddCategory()}
              className={`mt-2 ${nameError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "name-error" : undefined}
            />
            {nameError && (
              <p id="name-error" className="text-sm text-destructive mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {nameError}
              </p>
            )}
          </div>

          {/* Image Upload Section */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Category Image</Label>

            {/* Upload Destination Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Upload Destination</Label>
              <div className="flex gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="categoryUploadDestination"
                    value="vps"
                    checked={uploadDestination === 'vps'}
                    onChange={(e) => setUploadDestination(e.target.value as 'drive' | 'vps')}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-sm">
                    VPS Server <span className="text-xs text-green-600 font-medium">(Recommended)</span>
                  </span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="categoryUploadDestination"
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
                  ? 'Images compressed to max 5MB and stored on server'
                  : 'Images uploaded to your connected Google Drive'}
              </p>
            </div>

            {/* Option 1: Upload from Device */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-muted-foreground">Option 1: Upload from Device</Label>
              <div className={`relative border-2 border-dashed rounded-lg overflow-hidden transition-colors ${isUploadingImage ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}>
                <input
                  type="file"
                  id="categoryImageUpload"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, false)}
                  className="hidden"
                  disabled={isUploadingImage || !isDriveConnected}
                />
                <label
                  htmlFor="categoryImageUpload"
                  className={`block p-6 text-center ${isUploadingImage || !isDriveConnected ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {isUploadingImage && uploadingFiles.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        <span className="font-medium text-foreground">Uploading...</span>
                      </div>
                      {uploadingFiles.map((file, index) => (
                        <div key={index} className="bg-background/80 rounded-lg p-3 border max-w-md mx-auto">
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
                          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ease-out rounded-full ${file.progress === 100 ? 'bg-green-500' : 'bg-primary'}`}
                              style={{ width: `${file.progress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {isDriveConnected ? 'Click to upload image' : 'Google Drive Not Connected'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isDriveConnected
                            ? 'PNG, JPG images. Will be uploaded to your Google Drive.'
                            : 'Connect Google Drive in Store Settings to enable uploads'}
                        </p>
                      </div>
                    </div>
                  )}
                </label>
              </div>
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
              <Label className="text-sm font-medium text-muted-foreground">Option 2: Paste Google Drive URL</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://drive.google.com/file/d/... (optional)"
                  value={newCategoryImage}
                  onChange={(e) => setNewCategoryImage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      // Convert URL before adding
                      handleConvertAndSetUrl(newCategoryImage, false);
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleConvertAndSetUrl(newCategoryImage, false)}
                  size="sm"
                  className="px-4"
                >
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Paste a Google Drive share link. It will be automatically converted to a direct image URL.
              </p>
            </div>

            {/* Image Preview */}
            {newCategoryImage && (
              <div
                data-image-preview
                className="border-2 border-primary/30 rounded-lg overflow-hidden bg-card shadow-sm animate-in fade-in slide-in-from-top-4 duration-500"
              >
                <div className="bg-primary/5 px-3 py-2 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 animate-in zoom-in duration-300" />
                    <p className="text-sm font-medium text-foreground">✓ Image Ready</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setNewCategoryImage("")}
                    className="h-6 w-6 p-0 hover:bg-destructive/10"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <div className="p-3">
                  <div className="max-w-xs mx-auto">
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden ring-2 ring-primary/20">
                      <img
                        src={convertToDirectImageUrl(newCategoryImage) || ''}
                        alt="Category Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400';
                        }}
                      />
                    </div>
                  </div>
                  <div className="mt-2 p-2 bg-muted/50 rounded text-xs break-all">
                    <span className="text-muted-foreground">URL: </span>
                    <span className="font-mono text-foreground">{newCategoryImage}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button onClick={handleAddCategory} disabled={isAdding} className="w-full">
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-2">Add Category</span>
          </Button>
        </div>

        {/* Categories List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Your Categories ({categories.length})</Label>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto mb-3 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Loading categories...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 rounded-full bg-muted">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">No categories yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add your first category using the form above
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="group relative bg-card border rounded-lg overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all duration-300"
                >
                  {/* Category Image */}
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    <img
                      src={convertToDirectImageUrl(category.image_url || '') || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'}
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400';
                      }}
                    />

                    {/* Overlay Actions (visible on hover) */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleEditCategory(category)}
                        className="shadow-lg"
                        title="Edit category"
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setCategoryToDelete(category)}
                        className="shadow-lg"
                        title="Delete category"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* Category Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {category.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Category
                    </p>
                  </div>

                  {/* Mobile Actions (always visible on mobile) */}
                  <div className="sm:hidden border-t p-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditCategory(category)}
                      className="flex-1"
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCategoryToDelete(category)}
                      className="flex-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Category</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the category "{categoryToDelete?.name}"? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Category Dialog */}
        <AlertDialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
          <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>Edit Category</AlertDialogTitle>
              <AlertDialogDescription>
                Update the category name and image.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category Name</label>
                <Input
                  placeholder="Enter category name..."
                  value={editingCategory?.newName || ""}
                  onChange={(e) => setEditingCategory(prev => prev ? { ...prev, newName: e.target.value } : null)}
                />
              </div>

              <div className="space-y-4">
                <label className="text-sm font-medium">Category Image</label>

                {/* Upload Destination Selector */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Upload Destination</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editCategoryUploadDestination"
                        value="vps"
                        checked={uploadDestination === 'vps'}
                        onChange={(e) => setUploadDestination(e.target.value as 'drive' | 'vps')}
                        className="w-4 h-4 text-primary"
                      />
                      <span className="text-xs">
                        VPS Server <span className="text-xs text-green-600 font-medium">(Recommended)</span>
                      </span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editCategoryUploadDestination"
                        value="drive"
                        checked={uploadDestination === 'drive'}
                        onChange={(e) => setUploadDestination(e.target.value as 'drive' | 'vps')}
                        className="w-4 h-4 text-primary"
                        disabled={!isDriveConnected}
                      />
                      <span className="text-xs">
                        Google Drive {!isDriveConnected && <span className="text-xs text-muted-foreground">(Not Connected)</span>}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Option 1: Upload from Device */}
                <div className="space-y-3">
                  <Label className="text-xs font-medium text-muted-foreground">Option 1: Upload from Device</Label>
                  <div className={`relative border-2 border-dashed rounded-lg overflow-hidden transition-colors ${isUploadingImage ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}>
                    <input
                      type="file"
                      id="editCategoryImageUpload"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, true)}
                      className="hidden"
                      disabled={isUploadingImage || !isDriveConnected}
                    />
                    <label
                      htmlFor="editCategoryImageUpload"
                      className={`block p-4 text-center ${isUploadingImage || !isDriveConnected ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {isUploadingImage && uploadingFiles.length > 0 ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            <span className="text-sm font-medium text-foreground">Uploading...</span>
                          </div>
                          {uploadingFiles.map((file, index) => (
                            <div key={index} className="bg-background/80 rounded-lg p-2 border">
                              <div className="flex items-center gap-2">
                                {file.progress < 100 ? (
                                  <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                                </div>
                                <span className="text-xs font-medium text-primary">{file.progress}%</span>
                              </div>
                              <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ease-out rounded-full ${file.progress === 100 ? 'bg-green-500' : 'bg-primary'}`}
                                  style={{ width: `${file.progress}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
                          <p className="text-xs font-medium">
                            {isDriveConnected ? 'Click to upload' : 'Google Drive Not Connected'}
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
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
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Option 2: Paste Google Drive URL</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://drive.google.com/file/d/..."
                      value={editingCategory?.newImageUrl || ""}
                      onChange={(e) => setEditingCategory(prev => prev ? { ...prev, newImageUrl: e.target.value } : null)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleConvertAndSetUrl(editingCategory?.newImageUrl || "", true);
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleConvertAndSetUrl(editingCategory?.newImageUrl || "", true)}
                      size="sm"
                      className="px-4"
                    >
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Paste a Google Drive share link. It will be automatically converted.
                  </p>
                </div>

                {/* Image Preview */}
                {editingCategory?.newImageUrl && (
                  <div className="border-2 border-primary/30 rounded-lg overflow-hidden bg-card shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="bg-primary/5 px-3 py-2 border-b flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 animate-in zoom-in duration-300" />
                        <p className="text-sm font-medium text-foreground">✓ Image Ready</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingCategory(prev => prev ? { ...prev, newImageUrl: "" } : null)}
                        className="h-6 w-6 p-0 hover:bg-destructive/10"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="p-3">
                      <div className="max-w-xs mx-auto">
                        <div className="aspect-video bg-muted rounded-lg overflow-hidden ring-2 ring-primary/20">
                          <img
                            src={convertToDirectImageUrl(editingCategory.newImageUrl) || ''}
                            alt="Category Preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400';
                            }}
                          />
                        </div>
                      </div>
                      <div className="mt-2 p-2 bg-muted/50 rounded text-xs break-all">
                        <span className="text-muted-foreground">URL: </span>
                        <span className="font-mono text-foreground">{editingCategory.newImageUrl}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleUpdateCategory} disabled={isUpdating}>
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Update
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
