-- Create coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
  discount_value numeric NOT NULL,
  max_discount numeric,
  min_order_value numeric,
  start_date timestamp with time zone NOT NULL,
  expiry_date timestamp with time zone NOT NULL,
  usage_limit_total integer,
  usage_limit_per_customer integer,
  applicable_to text NOT NULL CHECK (applicable_to IN ('all', 'products', 'categories')),
  customer_type text NOT NULL CHECK (customer_type IN ('all', 'new', 'returning')),
  is_first_order boolean NOT NULL DEFAULT false,
  order_type text NOT NULL CHECK (order_type IN ('all', 'online', 'cod')),
  status text NOT NULL CHECK (status IN ('active', 'disabled', 'expired')) DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(store_id, code)
);

-- Create coupon_products table
CREATE TABLE IF NOT EXISTS public.coupon_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  is_excluded boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create coupon_categories table
CREATE TABLE IF NOT EXISTS public.coupon_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create coupon_usage table
CREATE TABLE IF NOT EXISTS public.coupon_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_phone text,
  customer_email text,
  discount_applied numeric NOT NULL,
  used_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coupons table
CREATE POLICY "Store owner can view own coupons"
ON public.coupons
FOR SELECT
USING (
  store_id IN (
    SELECT id FROM public.stores WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Store owner can create coupons"
ON public.coupons
FOR INSERT
WITH CHECK (
  store_id IN (
    SELECT id FROM public.stores WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Store owner can update own coupons"
ON public.coupons
FOR UPDATE
USING (
  store_id IN (
    SELECT id FROM public.stores WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Store owner can delete own coupons"
ON public.coupons
FOR DELETE
USING (
  store_id IN (
    SELECT id FROM public.stores WHERE user_id = auth.uid()
  )
);

-- RLS Policies for coupon_products table
CREATE POLICY "Store owner can view coupon products"
ON public.coupon_products
FOR SELECT
USING (
  coupon_id IN (
    SELECT id FROM public.coupons WHERE store_id IN (
      SELECT id FROM public.stores WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Store owner can manage coupon products"
ON public.coupon_products
FOR ALL
USING (
  coupon_id IN (
    SELECT id FROM public.coupons WHERE store_id IN (
      SELECT id FROM public.stores WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policies for coupon_categories table
CREATE POLICY "Store owner can view coupon categories"
ON public.coupon_categories
FOR SELECT
USING (
  coupon_id IN (
    SELECT id FROM public.coupons WHERE store_id IN (
      SELECT id FROM public.stores WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Store owner can manage coupon categories"
ON public.coupon_categories
FOR ALL
USING (
  coupon_id IN (
    SELECT id FROM public.coupons WHERE store_id IN (
      SELECT id FROM public.stores WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policies for coupon_usage table
CREATE POLICY "Store owner can view coupon usage"
ON public.coupon_usage
FOR SELECT
USING (
  coupon_id IN (
    SELECT id FROM public.coupons WHERE store_id IN (
      SELECT id FROM public.stores WHERE user_id = auth.uid()
    )
  )
);

-- Create indexes for better query performance
CREATE INDEX idx_coupons_store_id ON public.coupons(store_id);
CREATE INDEX idx_coupons_code ON public.coupons(code);
CREATE INDEX idx_coupons_status ON public.coupons(status);
CREATE INDEX idx_coupons_expiry_date ON public.coupons(expiry_date);
CREATE INDEX idx_coupon_products_coupon_id ON public.coupon_products(coupon_id);
CREATE INDEX idx_coupon_products_product_id ON public.coupon_products(product_id);
CREATE INDEX idx_coupon_categories_coupon_id ON public.coupon_categories(coupon_id);
CREATE INDEX idx_coupon_categories_category_id ON public.coupon_categories(category_id);
CREATE INDEX idx_coupon_usage_coupon_id ON public.coupon_usage(coupon_id);
CREATE INDEX idx_coupon_usage_order_id ON public.coupon_usage(order_id);
CREATE INDEX idx_coupon_usage_used_at ON public.coupon_usage(used_at);
