-- ============================================
-- Add Design Version History Tracking
-- ============================================

-- Add version tracking columns to store_design_state
ALTER TABLE store_design_state
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS version_history JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN store_design_state.version IS 'Current design version number (auto-increments on publish)';
COMMENT ON COLUMN store_design_state.version_history IS 'Array of previous design versions (keeps last 10)';
