-- ============================================
-- Set Up Daily Archive Cron Job
-- Run this AFTER deploying the archive-ai-history edge function
-- ============================================

-- STEP 1: Replace these placeholders with your actual values:
-- YOUR_PROJECT_REF: Your Supabase project reference (e.g., vexeuxsvckpfvuxqchqu)
-- YOUR_SERVICE_ROLE_KEY: Your service role key from Supabase settings

-- STEP 2: Run this SQL in Supabase SQL Editor:

SELECT cron.schedule(
  'daily-ai-history-archive',
  '0 2 * * *', -- Every day at 2 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/archive-ai-history',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('action', 'daily_archive')
  ) as request_id;
  $$
);

-- ============================================
-- Verify Cron Job is Scheduled
-- ============================================
SELECT * FROM cron.job WHERE jobname = 'daily-ai-history-archive';

-- ============================================
-- View Cron Job Execution History
-- ============================================
SELECT
  jobid,
  runid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobname = 'daily-ai-history-archive'
ORDER BY start_time DESC
LIMIT 10;

-- ============================================
-- Manual Test (Optional)
-- ============================================
-- To test the archive manually without waiting for cron:
-- Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY

SELECT net.http_post(
  url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/archive-ai-history',
  headers := jsonb_build_object(
    'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
    'Content-Type', 'application/json'
  ),
  body := jsonb_build_object('action', 'daily_archive')
) as request_id;

-- ============================================
-- Unschedule Cron Job (if needed)
-- ============================================
-- SELECT cron.unschedule('daily-ai-history-archive');
