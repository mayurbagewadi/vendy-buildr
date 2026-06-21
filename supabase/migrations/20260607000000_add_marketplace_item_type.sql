-- Add item type support to marketplace features
ALTER TABLE marketplace_features
ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'feature';

UPDATE marketplace_features
SET item_type = COALESCE(NULLIF(item_type, ''), 'feature');
