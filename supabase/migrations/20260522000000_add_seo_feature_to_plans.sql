-- Add enable_seo feature flag to subscription_plans
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS enable_seo BOOLEAN DEFAULT false;
