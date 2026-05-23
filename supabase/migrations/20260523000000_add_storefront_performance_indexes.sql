-- ============================================================
-- Storefront Performance Indexes
-- 2026-05-23
--
-- Problem: Every storefront page load triggers full table scans
-- on products, categories, and store_design_state because no
-- indexes exist on the columns used in every storefront query.
--
-- Impact: These indexes reduce query time by up to 100x on
-- growing tables (Supabase/PostgreSQL sequential scan → B-Tree).
-- ============================================================

-- ── Products ──────────────────────────────────────────────────
-- Composite: covers store filter + status filter + date sort in one index.
-- This is the most critical index — used on EVERY storefront page.
CREATE INDEX IF NOT EXISTS idx_products_store_status_created
  ON products(store_id, status, created_at DESC);

-- Partial index: published-only queries (smaller footprint, faster lookup).
-- Matches the exact pattern in getPublishedProducts().
CREATE INDEX IF NOT EXISTS idx_products_published_by_store
  ON products(store_id, created_at DESC)
  WHERE status = 'published';

-- Slug lookup — product detail page SEO URLs.
CREATE INDEX IF NOT EXISTS idx_products_slug
  ON products(slug)
  WHERE slug IS NOT NULL;

-- ── Categories ────────────────────────────────────────────────
-- Every store homepage fetches categories by store_id.
CREATE INDEX IF NOT EXISTS idx_categories_store_id
  ON categories(store_id);

-- ── AI Design State ───────────────────────────────────────────
-- AI design CSS is fetched on every storefront page load.
CREATE INDEX IF NOT EXISTS idx_store_design_state_store_id
  ON store_design_state(store_id);

-- ── Profiles ─────────────────────────────────────────────────
-- Profile lookup by user_id runs on every store page for contact info.
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON profiles(user_id);

-- ── Stores ───────────────────────────────────────────────────
-- Slug-based store lookup (path routing: /storeslug/products etc).
-- subdomain + custom_domain indexes already exist; slug was missing.
CREATE INDEX IF NOT EXISTS idx_stores_slug
  ON stores(slug)
  WHERE slug IS NOT NULL;
