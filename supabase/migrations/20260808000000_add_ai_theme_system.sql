-- ─────────────────────────────────────────────────────────────────────────────
-- AI Theme System
-- Stores AI-generated complete HTML themes per store.
-- Separated from the stores table so the large HTML blob is never pulled on
-- every storefront page load (StoreContext only reads the lightweight flag).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Lightweight flag on stores — read on every page load, costs 1 byte
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS ai_theme_enabled BOOLEAN NOT NULL DEFAULT false;

-- 2. Main theme storage — only fetched when ai_theme_enabled = true
CREATE TABLE IF NOT EXISTS store_ai_themes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID        NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,

  -- AI Designer working draft (not visible to customers)
  draft_html       TEXT,
  draft_prompt     TEXT,                              -- last prompt that produced the draft
  draft_created_at TIMESTAMPTZ,

  -- Published theme (live, visible to customers)
  published_html   TEXT,
  published_at     TIMESTAMPTZ,

  -- Last 5 generated versions for history/restore
  -- [{id, html, prompt, created_at}]
  version_history  JSONB       NOT NULL DEFAULT '[]'::jsonb,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Auto-update updated_at on every write
CREATE OR REPLACE FUNCTION _update_store_ai_themes_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_ai_themes_updated_at ON store_ai_themes;
CREATE TRIGGER trg_store_ai_themes_updated_at
  BEFORE UPDATE ON store_ai_themes
  FOR EACH ROW EXECUTE FUNCTION _update_store_ai_themes_ts();

-- 4. Index — every storefront lookup is store_id → html
CREATE INDEX IF NOT EXISTS idx_store_ai_themes_store_id ON store_ai_themes(store_id);

-- 5. Row-level security
ALTER TABLE store_ai_themes ENABLE ROW LEVEL SECURITY;

-- Store owner: full access to their own row
CREATE POLICY "sat_owner_all" ON store_ai_themes
  FOR ALL
  USING  (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Public / anon: read published HTML only (storefront rendering)
-- draft_html is never exposed — policy allows select but callers should
-- only select published_html in public contexts.
CREATE POLICY "sat_public_read" ON store_ai_themes
  FOR SELECT
  USING (published_html IS NOT NULL);

-- 6. Service role bypass (edge functions use service role)
-- No explicit policy needed — service role bypasses RLS by default.
