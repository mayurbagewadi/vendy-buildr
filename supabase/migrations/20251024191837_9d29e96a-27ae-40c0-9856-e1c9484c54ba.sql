-- Drop the existing policy
DROP POLICY IF EXISTS "Super admins can manage all subscriptions" ON subscriptions;

-- Recreate with proper WITH CHECK for INSERT operations
CREATE POLICY "Super admins can manage all subscriptions"
ON subscriptions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));