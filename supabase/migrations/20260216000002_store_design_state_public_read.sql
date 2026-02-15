-- Allow anyone (including unauthenticated visitors) to read store design state
-- This is required for the customer-facing store to load AI-generated CSS
-- Design data only contains CSS variables (colors, radius) — not sensitive
CREATE POLICY "Anyone can read store design state"
  ON store_design_state FOR SELECT
  USING (true);
