-- Add AI voice embed code field to stores table
ALTER TABLE stores
ADD COLUMN ai_voice_embed_code TEXT;

-- Add AI voice feature flag to subscription plans
ALTER TABLE subscription_plans
ADD COLUMN enable_ai_voice BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN stores.ai_voice_embed_code IS 'ElevenLabs conversational AI embed code for the store';
COMMENT ON COLUMN subscription_plans.enable_ai_voice IS 'Enable AI voice assistant feature for this plan';