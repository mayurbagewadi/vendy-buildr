-- ─────────────────────────────────────────────────────────────────────────────
-- Customer Reviews — Marketplace plugin (slug: customer-reviews).
--
-- Store owners type in genuine reviews they received (max 20 per store) and an
-- optional link to their Google reviews page. Separate from the Google Reviews
-- (Places API) plugin — no shared tables or columns.
--
-- Security model:
--   - Owners manage only their own store's reviews (RLS).
--   - Adding/editing requires the plugin to be installed (enabled_features).
--   - The public never reads the table directly; the storefront calls
--     get_store_customer_reviews(), which returns visible reviews only, and
--     only while the plugin is installed and the store is active.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Reviews table
CREATE TABLE IF NOT EXISTS store_customer_reviews (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_name  TEXT        NOT NULL CHECK (char_length(btrim(customer_name)) BETWEEN 1 AND 80),
  rating         SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text    TEXT        NOT NULL CHECK (char_length(btrim(review_text)) BETWEEN 1 AND 1000),
  review_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  is_visible     BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_customer_reviews_store_date
  ON store_customer_reviews (store_id, review_date DESC, created_at DESC);

-- 2. Plugin's own Google reviews link (not shared with stores.google_maps_url)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS customer_reviews_google_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_customer_reviews_google_url_check'
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT stores_customer_reviews_google_url_check
      CHECK (
        customer_reviews_google_url IS NULL
        OR (customer_reviews_google_url ~* '^https://' AND char_length(customer_reviews_google_url) <= 500)
      );
  END IF;
END $$;

-- 3. Guard trigger: 20-review limit, no future dates, no moving rows between stores
CREATE OR REPLACE FUNCTION store_customer_reviews_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  review_count INTEGER;
BEGIN
  -- +1 day tolerance: DB runs in UTC, owners in IST can be a day ahead.
  IF NEW.review_date > CURRENT_DATE + 1 THEN
    RAISE EXCEPTION 'Review date cannot be in the future' USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Serialize inserts per store so two parallel requests cannot pass the limit.
    PERFORM pg_advisory_xact_lock(hashtext('store_customer_reviews:' || NEW.store_id::text));

    SELECT count(*) INTO review_count
    FROM store_customer_reviews
    WHERE store_id = NEW.store_id;

    IF review_count >= 20 THEN
      RAISE EXCEPTION 'Review limit reached (20 per store)' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF NEW.store_id <> OLD.store_id THEN
      RAISE EXCEPTION 'Cannot move a review to another store' USING ERRCODE = 'check_violation';
    END IF;
    NEW.created_at := OLD.created_at;
  END IF;

  NEW.customer_name := btrim(NEW.customer_name);
  NEW.review_text   := btrim(NEW.review_text);
  NEW.updated_at    := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_customer_reviews_guard ON store_customer_reviews;
CREATE TRIGGER trg_store_customer_reviews_guard
  BEFORE INSERT OR UPDATE ON store_customer_reviews
  FOR EACH ROW EXECUTE FUNCTION store_customer_reviews_guard();

-- 4. RLS — owners only; no public policy (public reads go through the function below)
ALTER TABLE store_customer_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON store_customer_reviews FROM anon;

DROP POLICY IF EXISTS "Owners can view their store customer reviews" ON store_customer_reviews;
CREATE POLICY "Owners can view their store customer reviews"
  ON store_customer_reviews
  FOR SELECT
  TO authenticated
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can add customer reviews when plugin installed" ON store_customer_reviews;
CREATE POLICY "Owners can add customer reviews when plugin installed"
  ON store_customer_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    store_id IN (
      SELECT id FROM stores
      WHERE user_id = auth.uid()
        AND 'customer-reviews' = ANY(COALESCE(enabled_features, '{}'::text[]))
    )
  );

DROP POLICY IF EXISTS "Owners can edit customer reviews when plugin installed" ON store_customer_reviews;
CREATE POLICY "Owners can edit customer reviews when plugin installed"
  ON store_customer_reviews
  FOR UPDATE
  TO authenticated
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()))
  WITH CHECK (
    store_id IN (
      SELECT id FROM stores
      WHERE user_id = auth.uid()
        AND 'customer-reviews' = ANY(COALESCE(enabled_features, '{}'::text[]))
    )
  );

-- Delete stays allowed after uninstall so owners can always clean up.
DROP POLICY IF EXISTS "Owners can delete their store customer reviews" ON store_customer_reviews;
CREATE POLICY "Owners can delete their store customer reviews"
  ON store_customer_reviews
  FOR DELETE
  TO authenticated
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- 5. Public read — one call returns link + visible reviews; empty when plugin not installed
CREATE OR REPLACE FUNCTION get_store_customer_reviews(p_store_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'google_url', s.customer_reviews_google_url,
        'reviews', COALESCE((
          SELECT jsonb_agg(
                   jsonb_build_object(
                     'id', r.id,
                     'customer_name', r.customer_name,
                     'rating', r.rating,
                     'review_text', r.review_text,
                     'review_date', r.review_date
                   )
                   ORDER BY r.review_date DESC, r.created_at DESC
                 )
          FROM (
            SELECT * FROM store_customer_reviews
            WHERE store_id = s.id AND is_visible = true
            ORDER BY review_date DESC, created_at DESC
            LIMIT 20
          ) r
        ), '[]'::jsonb)
      )
      FROM stores s
      WHERE s.id = p_store_id
        AND s.is_active = true
        AND 'customer-reviews' = ANY(COALESCE(s.enabled_features, '{}'::text[]))
    ),
    jsonb_build_object('google_url', NULL, 'reviews', '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION get_store_customer_reviews(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_store_customer_reviews(UUID) TO anon, authenticated;

-- 6. Marketplace card — starts inactive at ₹0; super admin sets price and activates.
INSERT INTO marketplace_features (name, slug, description, icon, item_type, is_free, price, is_active, menu_order)
VALUES (
  'Customer Reviews',
  'customer-reviews',
  'Show genuine customer reviews on your store, with a link to all your reviews on Google. No Google billing needed.',
  'MessageSquare',
  'plugin',
  true,
  0,
  false,
  4
)
ON CONFLICT (slug) DO NOTHING;
