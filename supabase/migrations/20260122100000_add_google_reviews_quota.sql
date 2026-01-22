-- Add Google Reviews quota columns to subscription_plans table
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS google_reviews_calls_limit INTEGER DEFAULT 15;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS google_reviews_period TEXT DEFAULT 'monthly'; -- 'monthly' or 'yearly'

-- Add Google Reviews usage tracking columns to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS google_reviews_calls_used INTEGER DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS google_reviews_last_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing plans with default limits
UPDATE subscription_plans SET google_reviews_calls_limit = 15, google_reviews_period = 'monthly' WHERE google_reviews_calls_limit IS NULL;
