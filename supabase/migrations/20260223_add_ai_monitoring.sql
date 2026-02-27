-- AI Generation Failures Monitoring Table
CREATE TABLE IF NOT EXISTS public.ai_generation_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_prompt TEXT NOT NULL,
  error_message TEXT,
  model TEXT,
  raw_ai_output TEXT,
  attempt_count INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending_review'
);

-- Indexes for monitoring queries
CREATE INDEX IF NOT EXISTS idx_ai_failures_store_time 
  ON public.ai_generation_failures(store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_failures_status 
  ON public.ai_generation_failures(status);

-- Add RLS policies
ALTER TABLE public.ai_generation_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stores can view their own failures"
  ON public.ai_generation_failures FOR SELECT
  USING (store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid()));
