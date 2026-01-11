-- Create media_library table to track all VPS uploaded images
CREATE TABLE IF NOT EXISTS media_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_mb DECIMAL(10, 2) NOT NULL,
  file_type TEXT NOT NULL, -- 'products', 'categories', 'banners'
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_media_library_store_id ON media_library(store_id);
CREATE INDEX IF NOT EXISTS idx_media_library_file_type ON media_library(file_type);

-- Enable RLS
ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own store's media
CREATE POLICY "Users can view their own media"
  ON media_library
  FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can delete their own media
CREATE POLICY "Users can delete their own media"
  ON media_library
  FOR DELETE
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  );

-- Policy: System can insert media (via edge functions)
CREATE POLICY "System can insert media"
  ON media_library
  FOR INSERT
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE media_library IS 'Tracks all VPS uploaded images with metadata for media library feature';
