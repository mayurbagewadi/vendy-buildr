-- ============================================
-- AI Designer Metrics & Monitoring
-- ============================================

-- Create metrics table for tracking AI Designer performance and usage
CREATE TABLE IF NOT EXISTS ai_designer_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'generate_design', 'chat', 'apply_design'
  model_used TEXT, -- e.g., 'moonshotai/kimi-k2', 'anthropic/claude-3.5-sonnet'
  tokens_consumed INTEGER DEFAULT 0,
  latency_ms INTEGER, -- Response time in milliseconds
  success BOOLEAN NOT NULL DEFAULT true,
  error_type TEXT, -- e.g., 'timeout', 'invalid_json', 'no_tokens'
  prompt_length INTEGER, -- Character count of user prompt
  design_published BOOLEAN DEFAULT false, -- Was the design applied to live store?
  css_sanitized BOOLEAN DEFAULT false, -- Was CSS sanitization triggered?
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_metrics_store ON ai_designer_metrics(store_id);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_created ON ai_designer_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_action ON ai_designer_metrics(action);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_success ON ai_designer_metrics(success);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_model ON ai_designer_metrics(model_used);

-- Comments
COMMENT ON TABLE ai_designer_metrics IS 'Tracks AI Designer usage, performance, and costs for analytics';
COMMENT ON COLUMN ai_designer_metrics.latency_ms IS 'AI API response time in milliseconds';
COMMENT ON COLUMN ai_designer_metrics.tokens_consumed IS 'Number of AI tokens used (for cost tracking)';
COMMENT ON COLUMN ai_designer_metrics.css_sanitized IS 'Whether dangerous CSS patterns were blocked';

-- RLS: Super admin can view all metrics
ALTER TABLE ai_designer_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can view all AI metrics"
  ON ai_designer_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );
