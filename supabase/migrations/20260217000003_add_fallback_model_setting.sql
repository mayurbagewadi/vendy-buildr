-- Add secondary fallback model setting
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS openrouter_fallback_model TEXT;

COMMENT ON COLUMN platform_settings.openrouter_fallback_model IS 'Secondary AI model to use if primary model fails (fallback)';
