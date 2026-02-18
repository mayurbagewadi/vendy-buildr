-- ============================================
-- AI Designer History Archive System
-- Auto-archive to Google Drive + Daily cleanup
-- ============================================

-- ============================================
-- 1. Add Google Drive Settings to Platform Settings
-- ============================================
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS google_drive_service_account_json TEXT,
ADD COLUMN IF NOT EXISTS google_drive_archive_folder_id TEXT;

COMMENT ON COLUMN platform_settings.google_drive_service_account_json IS 'Google Drive Service Account JSON credentials for AI history archiving';
COMMENT ON COLUMN platform_settings.google_drive_archive_folder_id IS 'Google Drive folder ID where AI history archives are stored';

-- ============================================
-- 2. Create AI History Archive Metadata Table
-- ============================================
CREATE TABLE IF NOT EXISTS ai_history_archives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  archive_date DATE NOT NULL, -- Date of archived records
  google_drive_file_id TEXT NOT NULL,
  google_drive_file_url TEXT,
  record_count INTEGER NOT NULL DEFAULT 0,
  file_size_bytes BIGINT,
  oldest_record_date TIMESTAMP WITH TIME ZONE,
  newest_record_date TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(archive_date)
);

COMMENT ON TABLE ai_history_archives IS 'Tracks AI designer history archives stored in Google Drive';

-- ============================================
-- 3. Create Index for Fast Lookups
-- ============================================
CREATE INDEX IF NOT EXISTS idx_ai_history_archives_date ON ai_history_archives(archive_date DESC);

-- ============================================
-- 4. Enable RLS (Super Admin Only)
-- ============================================
ALTER TABLE ai_history_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can view all archive records"
  ON ai_history_archives FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admin can manage archive records"
  ON ai_history_archives FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- ============================================
-- 5. Create Function to Archive Old Records
-- ============================================
-- Note: This function will be created manually after getting Supabase URL
-- The actual archive logic is in the edge function
-- For now, create a placeholder that will be updated with correct URL

COMMENT ON SCHEMA public IS 'Archive function will be set up via cron job calling edge function directly';

-- ============================================
-- 6. Schedule Daily Archive Job (2 AM)
-- ============================================
-- Note: Requires pg_cron extension (enabled in Supabase by default)
-- This will be set up separately via SQL after migration
-- Command: SELECT cron.schedule('daily-ai-history-archive', '0 2 * * *', 'SELECT archive_old_ai_history();');
