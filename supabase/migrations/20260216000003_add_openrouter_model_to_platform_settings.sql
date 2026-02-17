-- Add openrouter_model column to platform_settings
-- Super admin can set any OpenRouter model ID without code changes
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS openrouter_model TEXT DEFAULT 'moonshotai/kimi-k2';
