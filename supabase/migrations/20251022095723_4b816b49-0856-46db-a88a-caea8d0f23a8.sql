-- Add website orders limit column to subscription_plans table
ALTER TABLE public.subscription_plans 
ADD COLUMN website_orders_limit integer;

COMMENT ON COLUMN public.subscription_plans.website_orders_limit IS 'Maximum number of orders through website per month. NULL means unlimited';

-- Add website orders tracking to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN website_orders_used integer DEFAULT 0;

COMMENT ON COLUMN public.subscriptions.website_orders_used IS 'Number of website orders used in current billing period';