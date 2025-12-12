-- Add orders_view_limit column to subscription_plans table
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS orders_view_limit integer DEFAULT 4;

-- Update existing plans with appropriate view limits
-- Free plan: can view 4 orders
UPDATE subscription_plans
SET orders_view_limit = 4
WHERE slug = 'free';

-- Pro plan: can view unlimited orders (999999 represents unlimited)
UPDATE subscription_plans
SET orders_view_limit = 999999
WHERE slug = 'pro';

-- Add comment
COMMENT ON COLUMN subscription_plans.orders_view_limit IS 'Maximum number of orders that can be viewed in admin panel. 999999 = unlimited';
