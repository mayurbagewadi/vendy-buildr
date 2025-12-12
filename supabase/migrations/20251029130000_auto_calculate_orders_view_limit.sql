-- Function to auto-calculate orders_view_limit based on website_orders_limit
CREATE OR REPLACE FUNCTION auto_set_orders_view_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-calculate orders_view_limit from website_orders_limit
  -- If website_orders_limit is 0 (unlimited), set view limit to 999999 (unlimited)
  -- If website_orders_limit is NULL (feature disabled), set view limit to NULL
  -- Otherwise, use the website_orders_limit value

  IF NEW.website_orders_limit = 0 THEN
    NEW.orders_view_limit := 999999;  -- Unlimited viewing
  ELSIF NEW.website_orders_limit IS NULL THEN
    NEW.orders_view_limit := NULL;  -- Feature disabled
  ELSE
    NEW.orders_view_limit := NEW.website_orders_limit;  -- Match website limit
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that runs before INSERT or UPDATE
DROP TRIGGER IF EXISTS set_orders_view_limit_trigger ON subscription_plans;
CREATE TRIGGER set_orders_view_limit_trigger
  BEFORE INSERT OR UPDATE OF website_orders_limit
  ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_orders_view_limit();

-- Update existing plans to match the new logic
UPDATE subscription_plans
SET orders_view_limit = CASE
  WHEN website_orders_limit = 0 THEN 999999
  WHEN website_orders_limit IS NULL THEN NULL
  ELSE website_orders_limit
END;

-- Add comment
COMMENT ON COLUMN subscription_plans.orders_view_limit IS 'Auto-calculated from website_orders_limit. Shows how many orders admin can view in panel. 999999 = unlimited';
