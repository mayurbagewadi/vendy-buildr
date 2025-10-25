-- Allow public read access to subscriptions for order validation
-- Customers need to check if the store can accept orders
CREATE POLICY "Public can view subscriptions for order validation" 
ON subscriptions 
FOR SELECT 
TO anon, authenticated
USING (true);