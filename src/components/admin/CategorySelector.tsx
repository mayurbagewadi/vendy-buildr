import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
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

interface CategorySelectorProps {
  value: string;
  onChange: (value: string) => void;
  storeId: string | null;
}

export function CategorySelector({ value, onChange, storeId }: CategorySelectorProps) {
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadCategories();
  }, [storeId]);

  const loadCategories = async () => {
    // Don't load categories if storeId is not set yet
    if (!storeId) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .eq("store_id", storeId)
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading categories",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addCustomCategory = async () => {
    if (!customCategory.trim()) {
      toast({
        title: "Invalid category",
        description: "Please enter a category name",
        variant: "destructive",
      });
      return;
    }

    // Check if category already exists
    if (categories.some(c => c.name.toLowerCase() === customCategory.trim().toLowerCase())) {
      toast({
        title: "Category exists",
        description: "This category already exists",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("categories")
        .insert({
          name: customCategory.trim(),
          store_id: storeId,
        })
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(data.name);
      setCustomCategory("");
      setShowCustomCategory(false);
      
      toast({
        title: "Category added",
        description: `${data.name} has been added`,
      });
    } catch (error: any) {
      toast({
        title: "Error adding category",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, category: { id: string; name: string }) => {
    e.stopPropagation();
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", categoryToDelete.id);

      if (error) throw error;

      setCategories(prev => prev.filter(c => c.id !== categoryToDelete.id));
      
      // If the deleted category was selected, clear the selection
      if (value === categoryToDelete.name) {
        onChange("");
      }

      toast({
        title: "Category deleted",
        description: `${categoryToDelete.name} has been removed`,
      });
    } catch (error: any) {
      toast({
        title: "Error deleting category",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    }
  };

  return (
    <>
      {!showCustomCategory ? (
        <>
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {categories.map((category) => (
                <SelectItem 
                  key={category.id} 
                  value={category.name}
                  className="flex items-center justify-between pr-2"
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{category.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 ml-2 hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => handleDeleteClick(e, category)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="p-0 h-auto text-xs"
            onClick={() => setShowCustomCategory(true)}
          >
            + Add custom category
          </Button>
        </>
      ) : (
        <div className="flex gap-2">
          <Input
            placeholder="Enter custom category"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomCategory();
              }
            }}
          />
          <Button type="button" size="sm" onClick={addCustomCategory}>
            Add
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setShowCustomCategory(false);
              setCustomCategory("");
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{categoryToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
