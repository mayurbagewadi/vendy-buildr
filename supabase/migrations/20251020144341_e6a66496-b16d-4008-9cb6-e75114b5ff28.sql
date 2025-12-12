-- Add image_url column to categories table
ALTER TABLE categories
ADD COLUMN image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN categories.image_url IS 'URL to category image, supports Google Drive links';