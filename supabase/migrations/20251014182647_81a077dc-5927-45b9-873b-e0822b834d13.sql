-- Create subscription plans table
CREATE TABLE public.subscription_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  monthly_price integer NOT NULL DEFAULT 0,
  yearly_price integer,
  max_products integer,
  trial_days integer DEFAULT 14,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  is_popular boolean DEFAULT false,
  badge_text text,
  badge_color text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create stores table
CREATE TABLE public.stores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  logo_url text,
  hero_banner_url text,
  whatsapp_number text,
  social_links jsonb DEFAULT '{}'::jsonb,
  google_sheet_connected boolean DEFAULT false,
  last_sheet_sync timestamp with time zone,
  custom_domain text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'trial',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  trial_ends_at timestamp with time zone,
  next_billing_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  payment_gateway text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create transactions table
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount integer NOT NULL,
  gst_amount integer DEFAULT 0,
  total_amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payment_gateway text NOT NULL,
  payment_id text,
  payment_method text,
  invoice_number text,
  refund_amount integer DEFAULT 0,
  refund_reason text,
  refunded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans (public read, super admin write)
CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admin can manage plans"
  ON public.subscription_plans FOR ALL
  USING (true);

-- RLS Policies for stores (owners can manage their store, super admin can view all)
CREATE POLICY "Users can view their own store"
  ON public.stores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own store"
  ON public.stores FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own store"
  ON public.stores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admin can view all stores"
  ON public.stores FOR SELECT
  USING (true);

-- RLS Policies for subscriptions
CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Super admin can view all subscriptions"
  ON public.subscriptions FOR SELECT
  USING (true);

CREATE POLICY "Super admin can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (true);

-- RLS Policies for transactions
CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Super admin can view all transactions"
  ON public.transactions FOR SELECT
  USING (true);

CREATE POLICY "Super admin can manage transactions"
  ON public.transactions FOR ALL
  USING (true);

-- Create updated_at triggers
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default free plan
INSERT INTO public.subscription_plans (name, slug, description, monthly_price, yearly_price, max_products, trial_days, features, display_order, is_active)
VALUES (
  'Free',
  'free',
  'Perfect for getting started',
  0,
  0,
  50,
  14,
  '["Google Sheets Sync", "WhatsApp Integration", "Basic Support"]'::jsonb,
  1,
  true
);