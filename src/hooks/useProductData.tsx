// Custom hook for product data management with error handling and caching

import { useState, useEffect, useCallback } from 'react';
import { 
  Product, 
  getProducts, 
  getPublishedProducts, 
  getProductById,
  addProduct as addProductUtil,
  updateProduct as updateProductUtil,
  deleteProduct as deleteProductUtil,
  initializeProducts
} from '@/lib/productData';
import { validateProduct } from '@/lib/dataValidation';
import { useToast } from '@/hooks/use-toast';

export const useProductData = (publishedOnly = false) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadProducts = useCallback(() => {
    try {
      setLoading(true);
      setError(null);
      // Initialize products with seed data if empty
      initializeProducts();
      const data = publishedOnly ? getPublishedProducts() : getProducts();
      setProducts(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load products';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [publishedOnly, toast]);

  useEffect(() => {
    loadProducts();

    // Listen for storage changes in other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'products' && e.newValue) {
        loadProducts();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadProducts]);

  const addProduct = useCallback(async (product: Product) => {
    try {
      const validationErrors = validateProduct(product);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '));
      }

      addProductUtil(product);
      loadProducts();
      toast({
        title: 'Success',
        description: 'Product added successfully',
      });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add product';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    }
  }, [loadProducts, toast]);

  const updateProduct = useCallback(async (id: string, product: Product) => {
    try {
      const validationErrors = validateProduct(product);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '));
      }

      updateProductUtil(id, product);
      loadProducts();
      toast({
        title: 'Success',
        description: 'Product updated successfully',
      });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update product';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    }
  }, [loadProducts, toast]);

  const deleteProduct = useCallback(async (id: string) => {
    try {
      deleteProductUtil(id);
      loadProducts();
      toast({
        title: 'Success',
        description: 'Product deleted successfully',
      });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete product';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    }
  }, [loadProducts, toast]);

  const getProduct = useCallback((id: string) => {
    return getProductById(id);
  }, []);

  const refresh = useCallback(() => {
    loadProducts();
  }, [loadProducts]);

  return {
    products,
    loading,
    error,
    addProduct,
    updateProduct,
    deleteProduct,
    getProduct,
    refresh,
  };
};
