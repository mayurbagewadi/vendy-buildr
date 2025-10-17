-- Enable all features for all subscription plans
UPDATE subscription_plans
SET 
  enable_location_sharing = true,
  enable_analytics = true;