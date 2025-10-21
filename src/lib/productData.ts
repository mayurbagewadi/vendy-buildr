// Product data utility using Supabase database
import { supabase } from '@/integrations/supabase/client';

export interface Variant {
  name: string;
  price: number;
  sku?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  basePrice?: number;
  base_price?: number;
  priceRange?: string;
  price_range?: string;
  stock?: number;
  sku?: string;
  status: 'published' | 'draft' | 'inactive';
  images: string[];
  videoUrl?: string;
  video_url?: string;
  variants?: Variant[];
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  store_id?: string;
}

// Get current store ID from session
const getStoreId = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  return store?.id || null;
};

// Initialize products - no longer needed with database
export const initializeProducts = (): void => {
  console.log('Products are now stored in Supabase database');
};

// Get all products for the current store
export const getProducts = async (): Promise<Product[]> => {
  const storeId = await getStoreId();
  if (!storeId) return [];

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }

  return (data || []) as unknown as Product[];
};

// Get published products (for customer view)
export const getPublishedProducts = async (storeId?: string): Promise<Product[]> => {
  if (!storeId) {
    const currentStoreId = await getStoreId();
    if (!currentStoreId) return [];
    storeId = currentStoreId;
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching published products:', error);
    return [];
  }

  return (data || []) as unknown as Product[];
};

// Get product by ID
export const getProductById = async (id: string): Promise<Product | null> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching product:', error);
    return null;
  }

  return data as unknown as Product | null;
};

// Save products - no longer needed with database
export const saveProducts = async (products: Product[]): Promise<void> => {
  console.warn('saveProducts is deprecated - use addProduct or updateProduct instead');
};

// Add product
export const addProduct = async (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product | null> => {
  const storeId = await getStoreId();
  if (!storeId) {
    throw new Error('No store found for current user');
  }

  const { data, error } = await supabase
    .from('products')
    .insert([{
      store_id: storeId,
      name: product.name,
      description: product.description,
      category: product.category,
      base_price: product.basePrice || product.base_price,
      price_range: product.priceRange || product.price_range,
      stock: product.stock || 0,
      sku: product.sku,
      status: product.status || 'draft',
      images: product.images || [],
      video_url: product.videoUrl || product.video_url,
      variants: (product.variants || []) as any,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding product:', error);
    throw error;
  }

  return data as unknown as Product;
};

// Update product
export const updateProduct = async (id: string, product: Partial<Product>): Promise<Product | null> => {
  const updateData: any = {};
  
  if (product.name !== undefined) updateData.name = product.name;
  if (product.description !== undefined) updateData.description = product.description;
  if (product.category !== undefined) updateData.category = product.category;
  if (product.basePrice !== undefined || product.base_price !== undefined) {
    updateData.base_price = product.basePrice || product.base_price;
  }
  if (product.priceRange !== undefined || product.price_range !== undefined) {
    updateData.price_range = product.priceRange || product.price_range;
  }
  if (product.stock !== undefined) updateData.stock = product.stock;
  if (product.sku !== undefined) updateData.sku = product.sku;
  if (product.status !== undefined) updateData.status = product.status;
  if (product.images !== undefined) updateData.images = product.images;
  if (product.videoUrl !== undefined || product.video_url !== undefined) {
    updateData.video_url = product.videoUrl || product.video_url;
  }
  if (product.variants !== undefined) updateData.variants = product.variants as any;

  const { data, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating product:', error);
    throw error;
  }

  return data as unknown as Product;
};

// Delete product
export const deleteProduct = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
};

// Get unique categories
export const getCategories = async (): Promise<string[]> => {
  const storeId = await getStoreId();
  if (!storeId) return [];

  const { data, error } = await supabase
    .from('products')
    .select('category')
    .eq('store_id', storeId)
    .not('category', 'is', null);

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  const categories = data.map(p => p.category).filter(Boolean);
  return Array.from(new Set(categories));
};
