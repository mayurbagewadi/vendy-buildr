-- Drop old policy that didn't explicitly allow anonymous users
DROP POLICY IF EXISTS "Published products are publicly viewable" ON public.products;

-- Create new policy that explicitly allows both anonymous and authenticated users
CREATE POLICY "Published products are publicly viewable"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (status = 'published');
