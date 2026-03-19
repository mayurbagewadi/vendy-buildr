-- Add enable_discounts_coupons feature flag to subscription_plans
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS enable_discounts_coupons BOOLEAN DEFAULT false;
