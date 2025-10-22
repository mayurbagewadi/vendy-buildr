-- Add email notification feature to subscription plans
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS enable_order_emails boolean DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN subscription_plans.enable_order_emails IS 'Enable automatic email notifications for new orders';