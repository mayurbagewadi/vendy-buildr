-- Add location columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_latitude decimal,
ADD COLUMN IF NOT EXISTS delivery_longitude decimal;

-- Add feature flags to subscription_plans table
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS enable_location_sharing boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS enable_analytics boolean DEFAULT false;

-- Add categories table for better category management
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(store_id, name)
);

-- Enable RLS on categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for categories
CREATE POLICY "Users can view their own categories"
  ON public.categories FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = categories.store_id 
    AND stores.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own categories"
  ON public.categories FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = categories.store_id 
    AND stores.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own categories"
  ON public.categories FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = categories.store_id 
    AND stores.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own categories"
  ON public.categories FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = categories.store_id 
    AND stores.user_id = auth.uid()
  ));

-- Super admin can manage all categories
CREATE POLICY "Super admin can manage categories"
  ON public.categories FOR ALL
  USING (true);

-- Trigger for updated_at on categories
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();