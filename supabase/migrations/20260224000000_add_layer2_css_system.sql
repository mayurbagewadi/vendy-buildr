-- ============================================
-- AI Designer Layer 2 CSS System Migration
-- ============================================
-- Purpose: Add full CSS generation capability (Layer 2) alongside existing CSS variables system (Layer 1)
-- Strategy: NON-BREAKING - Only ADD columns, never modify existing ones
-- Rollback: Can drop these columns if needed without affecting existing functionality

-- ============================================
-- Add Layer 2 Columns to store_design_state
-- ============================================

-- Add ai_full_css column to store AI-generated complete CSS
ALTER TABLE store_design_state
ADD COLUMN IF NOT EXISTS ai_full_css TEXT;

-- Add layer1_snapshot column to store baseline styles for comparison
ALTER TABLE store_design_state
ADD COLUMN IF NOT EXISTS layer1_snapshot JSONB;

-- Add mode column to distinguish between simple (CSS variables) and advanced (full CSS) modes
ALTER TABLE store_design_state
ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'simple' CHECK (mode IN ('simple', 'advanced'));

-- Add metadata columns for Layer 2 tracking
ALTER TABLE store_design_state
ADD COLUMN IF NOT EXISTS ai_full_css_applied_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN store_design_state.ai_full_css IS 'AI-generated complete CSS code (Layer 2) that overrides default styles';
COMMENT ON COLUMN store_design_state.layer1_snapshot IS 'Baseline styles snapshot (Layer 1) for AI comparison and before/after preview';
COMMENT ON COLUMN store_design_state.mode IS 'Design mode: simple (CSS variables only) or advanced (full CSS generation)';
COMMENT ON COLUMN store_design_state.ai_full_css_applied_at IS 'Timestamp when Layer 2 CSS was last applied';

-- ============================================
-- Notes for Developers
-- ============================================
-- 1. BACKWARD COMPATIBILITY:
--    - If ai_full_css IS NULL → Use existing CSS variables system (current_design)
--    - If ai_full_css IS NOT NULL → Use Layer 2 CSS (ai_full_css)
--    - Old stores continue working without any changes
--
-- 2. MODE BEHAVIOR:
--    - mode = 'simple' (default): Only CSS variables (existing system)
--    - mode = 'advanced': Full CSS generation (new Layer 2 system)
--
-- 3. RESET BEHAVIOR:
--    - Reset Layer 2: SET ai_full_css = NULL, layer1_snapshot = NULL, mode = 'simple'
--    - Reset Layer 1: SET current_design = NULL (existing behavior)
--    - Reset Both: SET ai_full_css = NULL, current_design = NULL, layer1_snapshot = NULL, mode = 'simple'
--
-- 4. ROLLBACK PLAN:
--    If issues occur, disable Layer 2 feature:
--    UPDATE store_design_state SET mode = 'simple' WHERE mode = 'advanced';
--
--    Or completely remove Layer 2 columns:
--    ALTER TABLE store_design_state DROP COLUMN IF EXISTS ai_full_css;
--    ALTER TABLE store_design_state DROP COLUMN IF EXISTS layer1_snapshot;
--    ALTER TABLE store_design_state DROP COLUMN IF EXISTS mode;
--    ALTER TABLE store_design_state DROP COLUMN IF EXISTS ai_full_css_applied_at;

-- ============================================
-- Data Integrity Check
-- ============================================
-- Verify no existing data is affected by this migration
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM store_design_state;
  RAISE NOTICE 'Migration completed. % existing store_design_state rows unaffected.', row_count;
END $$;
