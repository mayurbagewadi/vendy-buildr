-- Backfill existing marketplace items into the new item taxonomy
-- Keep this data migration centralized so future items are classified at creation time, not via one-off migrations
UPDATE marketplace_features
SET item_type = 'plugin'
WHERE slug IN ('google-reviews', 'shipping');
