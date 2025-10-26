-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Customers can place orders" ON orders;

-- Recreate as a permissive policy (allows anonymous users to insert orders)
CREATE POLICY "Customers can place orders" 
ON orders 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);