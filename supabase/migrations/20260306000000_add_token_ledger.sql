-- ════════════════════════════════════════════════════════════════════════
-- Migration: Add token ledger + optimistic locking for accurate billing
-- Date: 2026-03-06
-- Purpose: Fix business loss — deduct ACTUAL OpenRouter tokens, not 1
-- ════════════════════════════════════════════════════════════════════════

-- Step 1: Add version column to ai_token_purchases for optimistic locking
-- This prevents race conditions when concurrent requests deduct tokens simultaneously.
ALTER TABLE ai_token_purchases ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;

-- Step 2: Create ai_token_ledger — receipt for every AI generation request
-- Each row = one idempotent billing event.
--   pending   → request in flight (OpenRouter being called)
--   completed → tokens deducted, CSS saved (normal success)
--   failed    → OpenRouter error, no tokens deducted (safe)
CREATE TABLE IF NOT EXISTS ai_token_ledger (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id          UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key   TEXT UNIQUE NOT NULL,       -- prevents double charge on retry
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  prompt_tokens     INTEGER DEFAULT 0,          -- input tokens from OpenRouter
  completion_tokens INTEGER DEFAULT 0,          -- output tokens from OpenRouter
  total_tokens      INTEGER DEFAULT 0,          -- sum deducted from balance
  cost_usd          DECIMAL(10,6) DEFAULT 0,    -- actual $ charged by OpenRouter
  cached_css        TEXT,                       -- generated CSS (for idempotency replay)
  purchase_id       UUID REFERENCES ai_token_purchases(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_token_ledger_store ON ai_token_ledger(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_token_ledger_idempotency ON ai_token_ledger(idempotency_key);

-- RLS: only service_role (edge functions) can access
ALTER TABLE ai_token_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages ai_token_ledger" ON ai_token_ledger;
CREATE POLICY "Service role manages ai_token_ledger"
  ON ai_token_ledger FOR ALL TO service_role USING (true);
