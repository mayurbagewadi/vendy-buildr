-- Allow customers to place orders (public access for guest checkout)
CREATE POLICY "Customers can place orders"
ON public.orders
FOR INSERT
WITH CHECK (true);