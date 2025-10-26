-- Drop all existing INSERT policies on orders table
DROP POLICY IF EXISTS "Customers can place orders" ON orders;
DROP POLICY IF EXISTS "Store owners can insert their orders" ON orders;

-- Create a single public policy that allows anyone to insert orders
CREATE POLICY "Allow public order insertion"
ON orders
FOR INSERT
TO public
WITH CHECK (true);