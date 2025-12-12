import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { convertToDirectImageUrl } from "@/lib/imageUtils";
import { DEMO_CATEGORIES } from "@/lib/demoProducts";
import { getRandomDefaultImage } from "@/lib/defaultImages";
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
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!store) return;
      setStoreId(store.id);

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
    if (!newCategoryName.trim()) {
      toast({
        title: "Error",
        description: "Category name cannot be empty",
        variant: "destructive",
      });
      return;
    }

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Category Form */}
        <div className="space-y-2">
          <Input
            placeholder="Enter category name..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleAddCategory()}
          />
          <Input
            placeholder="Enter Google Drive image URL (optional)..."
            value={newCategoryImage}
            onChange={(e) => setNewCategoryImage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleAddCategory()}
          />
          {newCategoryImage && (
            <div className="border rounded-lg p-2 bg-muted/50">
              <p className="text-xs text-muted-foreground mb-2">Image Preview:</p>
              <img 
                src={convertToDirectImageUrl(newCategoryImage) || ''} 
                alt="Preview" 
                className="w-24 h-24 object-cover rounded"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <p className="text-xs text-destructive mt-1 hidden">Failed to load image. Please check the URL.</p>
            </div>
          )}
          <Button onClick={handleAddCategory} disabled={isAdding} className="w-full">
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-2">Add Category</span>
          </Button>
        </div>

        {/* Categories List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No categories yet. Add your first category above.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge key={category.id} variant="secondary" className="px-3 py-2 flex items-center gap-2">
                <span>{category.name}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditCategory(category)}
                    className="hover:text-primary transition-colors"
                    title="Edit category"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setCategoryToDelete(category)}
                    className="hover:text-destructive transition-colors"
                    title="Delete category"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </Badge>
            ))}
          </div>
        )}

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
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Edit Category</AlertDialogTitle>
              <AlertDialogDescription>
                Update the category name and image URL.
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Image URL (optional)</label>
                <Input
                  placeholder="Enter Google Drive image URL..."
                  value={editingCategory?.newImageUrl || ""}
                  onChange={(e) => setEditingCategory(prev => prev ? { ...prev, newImageUrl: e.target.value } : null)}
                />
                {editingCategory?.newImageUrl && (
                  <div className="border rounded-lg p-2 bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-2">Image Preview:</p>
                    <img 
                      src={convertToDirectImageUrl(editingCategory.newImageUrl) || ''} 
                      alt="Preview" 
                      className="w-24 h-24 object-cover rounded"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
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
