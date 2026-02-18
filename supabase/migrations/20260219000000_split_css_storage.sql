-- ============================================
-- Split CSS Storage for AI Designer
-- Prevents JSON truncation by moving large CSS to TEXT column
-- ============================================

-- Add dedicated TEXT column for CSS overrides
ALTER TABLE ai_designer_history
ADD COLUMN IF NOT EXISTS ai_css_overrides TEXT;

-- Add comment for documentation
COMMENT ON COLUMN ai_designer_history.ai_css_overrides IS
'Stores large CSS override strings separately from ai_response JSONB to prevent truncation. The ai_response JSONB now only contains: summary, changes_list, layout, css_variables.';

-- Create index for faster queries when loading designs
CREATE INDEX IF NOT EXISTS idx_ai_designer_history_css_not_null
ON ai_designer_history(store_id, created_at DESC)
WHERE ai_css_overrides IS NOT NULL;

-- Add size tracking column for monitoring (optional but useful)
ALTER TABLE ai_designer_history
ADD COLUMN IF NOT EXISTS response_size_bytes INTEGER;

COMMENT ON COLUMN ai_designer_history.response_size_bytes IS
'Tracks total response size for monitoring and optimization. Helps detect when responses are approaching limits.';
