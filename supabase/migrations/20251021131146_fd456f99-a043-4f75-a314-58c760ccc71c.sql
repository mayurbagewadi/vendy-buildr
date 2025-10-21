-- Fix all critical security issues

-- 1. Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. Create products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  base_price integer,
  price_range text,
  stock integer DEFAULT 0,
  sku text,
  status text DEFAULT 'draft' NOT NULL CHECK (status IN ('published', 'draft', 'inactive')),
  images jsonb DEFAULT '[]'::jsonb,
  video_url text,
  variants jsonb DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Add trigger for products updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Fix RLS policies - Drop old insecure policies and create new ones

-- Fix super_admins policies
DROP POLICY IF EXISTS "Super admins can view their own data" ON public.super_admins;
CREATE POLICY "Super admins can view super_admins table"
  ON public.super_admins
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Fix stores policies
DROP POLICY IF EXISTS "Super admin can view all stores" ON public.stores;
CREATE POLICY "Super admins can view all stores"
  ON public.stores
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can manage all stores"
  ON public.stores
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Fix profiles policies
DROP POLICY IF EXISTS "Super admin can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can manage all profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Add missing INSERT policy for profiles
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Fix categories policies
DROP POLICY IF EXISTS "Super admin can manage categories" ON public.categories;
CREATE POLICY "Super admins can manage all categories"
  ON public.categories
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Fix subscription_plans policies
DROP POLICY IF EXISTS "Super admin can manage plans" ON public.subscription_plans;
CREATE POLICY "Super admins can manage all plans"
  ON public.subscription_plans
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Fix subscriptions policies
DROP POLICY IF EXISTS "Super admin can manage subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Super admin can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Super admins can view all subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can manage all subscriptions"
  ON public.subscriptions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Fix transactions policies
DROP POLICY IF EXISTS "Super admin can manage transactions" ON public.transactions;
DROP POLICY IF EXISTS "Super admin can view all transactions" ON public.transactions;
CREATE POLICY "Super admins can view all transactions"
  ON public.transactions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can manage all transactions"
  ON public.transactions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Fix store_activity_logs policies
DROP POLICY IF EXISTS "Super admin can manage activity logs" ON public.store_activity_logs;
DROP POLICY IF EXISTS "Super admin can view all activity logs" ON public.store_activity_logs;
CREATE POLICY "Super admins can view all activity logs"
  ON public.store_activity_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can manage all activity logs"
  ON public.store_activity_logs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 6. Create RLS policies for products table
CREATE POLICY "Store owners can view their products"
  ON public.products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = products.store_id
      AND stores.user_id = auth.uid()
    )
  );

CREATE POLICY "Store owners can insert their products"
  ON public.products
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = products.store_id
      AND stores.user_id = auth.uid()
    )
  );

CREATE POLICY "Store owners can update their products"
  ON public.products
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = products.store_id
      AND stores.user_id = auth.uid()
    )
  );

CREATE POLICY "Store owners can delete their products"
  ON public.products
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = products.store_id
      AND stores.user_id = auth.uid()
    )
  );

CREATE POLICY "Published products are publicly viewable"
  ON public.products
  FOR SELECT
  USING (status = 'published');

CREATE POLICY "Super admins can manage all products"
  ON public.products
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 7. Create policies for user_roles table
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can manage all roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));