-- Add public read access to categories for active stores
CREATE POLICY "Anyone can view categories for active stores"
  ON public.categories FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = categories.store_id
      AND stores.is_active = true
    )
  );
