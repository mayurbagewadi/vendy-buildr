-- Add WhatsApp order limit to subscription plans
ALTER TABLE subscription_plans 
ADD COLUMN whatsapp_orders_limit integer DEFAULT NULL;

-- Add usage tracking to subscriptions table
ALTER TABLE subscriptions
ADD COLUMN whatsapp_orders_used integer DEFAULT 0,
ADD COLUMN current_period_start timestamp with time zone DEFAULT now(),
ADD COLUMN current_period_end timestamp with time zone DEFAULT (now() + interval '1 month');

-- Create index for better performance
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);