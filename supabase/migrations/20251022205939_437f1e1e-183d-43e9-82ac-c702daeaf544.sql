-- Allow public access to view active stores
CREATE POLICY "Public can view active stores" 
ON public.stores 
FOR SELECT 
USING (is_active = true);