-- Create video_generations table for storing video generation tasks
-- Videos are stored locally in C:\Users\Administrator\Desktop\Video
-- and served via Express API on http://localhost:3001
CREATE TABLE public.video_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  script TEXT NOT NULL,
  template VARCHAR(50) NOT NULL,
  voice_id VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  video_url TEXT,
  audio_url TEXT,
  file_size_mb DECIMAL(10, 2),
  duration_seconds INTEGER,
  error_message TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'generating_audio', 'rendering', 'completed', 'failed')),
  CONSTRAINT valid_template CHECK (template IN ('tutorial', 'presentation', 'demo')),
  CONSTRAINT valid_progress CHECK (progress >= 0 AND progress <= 100)
);

-- Create indexes for common queries
CREATE INDEX idx_video_generations_created_by ON public.video_generations(created_by);
CREATE INDEX idx_video_generations_status ON public.video_generations(status);
CREATE INDEX idx_video_generations_created_at ON public.video_generations(created_at DESC);

-- Enable RLS
ALTER TABLE public.video_generations ENABLE ROW LEVEL SECURITY;

-- Policy: SuperAdmin can view/manage all videos
CREATE POLICY "superadmin_manage_all_videos" ON public.video_generations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Policy: Creator can view their own videos
CREATE POLICY "user_view_own_videos" ON public.video_generations
  FOR SELECT
  USING (created_by = auth.uid());

-- Add comments
COMMENT ON TABLE public.video_generations IS 'Stores video generation tasks for marketing content. Videos stored locally.';
COMMENT ON COLUMN public.video_generations.status IS 'Status: pending, generating_audio, rendering, completed, failed';
COMMENT ON COLUMN public.video_generations.progress IS 'Progress percentage 0-100';
COMMENT ON COLUMN public.video_generations.template IS 'Video template: tutorial, presentation, demo';
COMMENT ON COLUMN public.video_generations.video_url IS 'Local video URL served via Express API (http://localhost:3001/video/{id})';
