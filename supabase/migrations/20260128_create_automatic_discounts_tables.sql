-- Create automatic_discounts table
CREATE TABLE IF NOT EXISTS public.automatic_discounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  rule_description text,
  rule_type text NOT NULL CHECK (rule_type IN ('tiered_value', 'new_customer', 'returning_customer', 'category', 'quantity')),
  order_type text NOT NULL DEFAULT 'all' CHECK (order_type IN ('all', 'online', 'cod')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  start_date timestamp with time zone NOT NULL DEFAULT now(),
  expiry_date timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create discount_tiers table (for tiered discounts)
CREATE TABLE IF NOT EXISTS public.discount_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discount_id uuid NOT NULL REFERENCES public.automatic_discounts(id) ON DELETE CASCADE,
  tier_order integer NOT NULL,
  min_order_value numeric,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
  discount_value numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create discount_rules table (for other trigger conditions)
CREATE TABLE IF NOT EXISTS public.discount_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discount_id uuid NOT NULL REFERENCES public.automatic_discounts(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  rule_value text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
  discount_value numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automatic_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automatic_discounts
CREATE POLICY "Store owner can view own automatic discounts"
ON public.automatic_discounts
FOR SELECT
USING (
  store_id IN (
    SELECT id FROM public.stores WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Store owner can create automatic discounts"
ON public.automatic_discounts
FOR INSERT
WITH CHECK (
  store_id IN (
    SELECT id FROM public.stores WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Store owner can update own automatic discounts"
ON public.automatic_discounts
FOR UPDATE
USING (
  store_id IN (
    SELECT id FROM public.stores WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Store owner can delete own automatic discounts"
ON public.automatic_discounts
FOR DELETE
USING (
  store_id IN (
    SELECT id FROM public.stores WHERE user_id = auth.uid()
  )
);

-- RLS Policies for discount_tiers
CREATE POLICY "Store owner can view discount tiers"
ON public.discount_tiers
FOR SELECT
USING (
  discount_id IN (
    SELECT id FROM public.automatic_discounts WHERE store_id IN (
      SELECT id FROM public.stores WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Store owner can manage discount tiers"
ON public.discount_tiers
FOR ALL
USING (
  discount_id IN (
    SELECT id FROM public.automatic_discounts WHERE store_id IN (
      SELECT id FROM public.stores WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policies for discount_rules
CREATE POLICY "Store owner can view discount rules"
ON public.discount_rules
FOR SELECT
USING (
  discount_id IN (
    SELECT id FROM public.automatic_discounts WHERE store_id IN (
      SELECT id FROM public.stores WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Store owner can manage discount rules"
ON public.discount_rules
FOR ALL
USING (
  discount_id IN (
    SELECT id FROM public.automatic_discounts WHERE store_id IN (
      SELECT id FROM public.stores WHERE user_id = auth.uid()
    )
  )
);

-- Create indexes for better performance
CREATE INDEX idx_automatic_discounts_store_id ON public.automatic_discounts(store_id);
CREATE INDEX idx_automatic_discounts_status ON public.automatic_discounts(status);
CREATE INDEX idx_automatic_discounts_expiry_date ON public.automatic_discounts(expiry_date);
CREATE INDEX idx_discount_tiers_discount_id ON public.discount_tiers(discount_id);
CREATE INDEX idx_discount_rules_discount_id ON public.discount_rules(discount_id);
