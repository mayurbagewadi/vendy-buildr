-- Update PRO plan with proper features
UPDATE subscription_plans 
SET features = '["Unlimited Products", "Advanced Analytics", "Priority Support", "Custom Domain", "Email Notifications", "Location Tracking", "Google Sheets Sync", "WhatsApp Integration"]'::jsonb,
    description = 'Perfect for growing businesses'
WHERE name = 'PRO';

-- Update Free plan description
UPDATE subscription_plans 
SET description = 'Perfect for getting started'
WHERE name = 'Free';