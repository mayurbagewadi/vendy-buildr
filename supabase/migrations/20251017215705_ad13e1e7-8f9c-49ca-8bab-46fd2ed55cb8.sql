-- Enable all features for all subscription plans for testing
UPDATE subscription_plans
SET 
  enable_location_sharing = true,
  enable_analytics = true
WHERE true;