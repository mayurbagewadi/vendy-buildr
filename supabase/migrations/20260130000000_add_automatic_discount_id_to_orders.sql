-- Add automatic_discount_id column to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS automatic_discount_id uuid REFERENCES public.automatic_discounts(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_automatic_discount_id ON public.orders(automatic_discount_id);
