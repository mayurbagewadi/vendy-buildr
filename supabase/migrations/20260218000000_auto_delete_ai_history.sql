-- Auto-delete ai_designer_history records older than 30 days
-- Runs every day at 2 AM UTC

SELECT cron.schedule(
  'delete-old-ai-history',
  '0 2 * * *',
  $$
    DELETE FROM ai_designer_history
    WHERE created_at < NOW() - INTERVAL '30 days';
  $$
);
