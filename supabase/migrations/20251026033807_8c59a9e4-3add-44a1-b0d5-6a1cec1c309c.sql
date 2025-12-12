-- Allow public to read their just-inserted orders (within 2 minutes)
CREATE POLICY "Allow public to read recent orders"
ON orders
FOR SELECT
TO public
USING (created_at > (now() - interval '2 minutes'));