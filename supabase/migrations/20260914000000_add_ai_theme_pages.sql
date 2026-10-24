-- ─────────────────────────────────────────────────────────────────────────────
-- AI Theme Pages
-- Extends the AI Designer "Build Theme" system to cover every storefront page,
-- not just the home page. `store_ai_themes` (existing table) keeps owning the
-- HOME page only, unchanged, so nothing that already works is touched.
-- This new table holds the other pages, one row per (store, page_type).
-- Checkout and Payment Success are intentionally NEVER stored here — those
-- stay on the shared, audited implementation for security/compliance reasons.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS store_ai_theme_pages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  page_type        TEXT        NOT NULL CHECK (page_type IN (
                                 'products', 'categories', 'product_detail',
                                 'cart', 'about', 'policies'
                               )),

  -- AI Designer working draft (not visible to customers)
  draft_html       TEXT,
  draft_created_at TIMESTAMPTZ,

  -- Published page (live, visible to customers)
  published_html   TEXT,
  published_at     TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (store_id, page_type)
);

CREATE OR REPLACE FUNCTION _update_store_ai_theme_pages_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_ai_theme_pages_updated_at ON store_ai_theme_pages;
CREATE TRIGGER trg_store_ai_theme_pages_updated_at
  BEFORE UPDATE ON store_ai_theme_pages
  FOR EACH ROW EXECUTE FUNCTION _update_store_ai_theme_pages_ts();

-- Every storefront lookup is (store_id, page_type) → html
CREATE INDEX IF NOT EXISTS idx_store_ai_theme_pages_lookup
  ON store_ai_theme_pages(store_id, page_type);

ALTER TABLE store_ai_theme_pages ENABLE ROW LEVEL SECURITY;

-- Store owner: full access to their own store's pages
CREATE POLICY "satp_owner_all" ON store_ai_theme_pages
  FOR ALL
  USING  (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Public / anon: read published pages only (storefront rendering)
CREATE POLICY "satp_public_read" ON store_ai_theme_pages
  FOR SELECT
  USING (published_html IS NOT NULL);

-- Service role (edge functions) bypasses RLS by default — no explicit policy needed.
