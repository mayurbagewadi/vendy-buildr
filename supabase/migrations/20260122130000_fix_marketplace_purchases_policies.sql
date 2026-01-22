-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Store owners can view their own purchases" ON marketplace_purchases;
DROP POLICY IF EXISTS "Store owners can insert their own purchases" ON marketplace_purchases;
DROP POLICY IF EXISTS "Super admin can view all purchases" ON marketplace_purchases;

-- Recreate policies
CREATE POLICY "Store owners can view their own purchases"
  ON marketplace_purchases
  FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Store owners can insert their own purchases"
  ON marketplace_purchases
  FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admin can view all purchases"
  ON marketplace_purchases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );
