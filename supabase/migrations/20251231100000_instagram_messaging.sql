-- Instagram Messages Table
CREATE TABLE IF NOT EXISTS instagram_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instagram_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  message_id TEXT,
  message_text TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  is_auto_reply BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Instagram Comments Table
CREATE TABLE IF NOT EXISTS instagram_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instagram_id TEXT NOT NULL,
  comment_id TEXT NOT NULL UNIQUE,
  comment_text TEXT,
  from_id TEXT,
  from_username TEXT,
  media_id TEXT,
  replied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add Instagram fields to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS instagram_business_id TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS instagram_access_token TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS instagram_token_expiry TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS instagram_username TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS instagram_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS auto_reply_settings JSONB DEFAULT '{"enabled": false, "default_message": "Thanks for your message! We will get back to you soon.", "rules": []}';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS comment_auto_reply_settings JSONB DEFAULT '{"enabled": false, "default_reply": "Thanks for your comment!"}';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_instagram_messages_instagram_id ON instagram_messages(instagram_id);
CREATE INDEX IF NOT EXISTS idx_instagram_messages_sender_id ON instagram_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_instagram_messages_timestamp ON instagram_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_instagram_comments_instagram_id ON instagram_comments(instagram_id);
CREATE INDEX IF NOT EXISTS idx_stores_instagram_business_id ON stores(instagram_business_id);

-- Enable RLS
ALTER TABLE instagram_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies (service role can do everything)
CREATE POLICY "Service role full access to instagram_messages" ON instagram_messages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to instagram_comments" ON instagram_comments
  FOR ALL USING (true) WITH CHECK (true);
