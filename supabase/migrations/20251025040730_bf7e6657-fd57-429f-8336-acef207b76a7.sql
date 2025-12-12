-- Drop the existing restrictive customer order policy
DROP POLICY IF EXISTS "Customers can place orders" ON orders;

-- Create a permissive policy that allows anyone to insert orders
CREATE POLICY "Customers can place orders" 
ON orders 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);