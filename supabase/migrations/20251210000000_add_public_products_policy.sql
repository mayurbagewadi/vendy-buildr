-- Add public read policy for published products
-- This allows sitemaps and public pages to read products without authentication

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Public can view published products" ON public.products;

-- Create new policy for public access to published products
CREATE POLICY "Public can view published products"
ON public.products
FOR SELECT
USING (status = 'published');

-- This allows anyone (including unauthenticated requests) to read published products
-- Private/draft products remain protected
