-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to cleanup old pending payment subscriptions
CREATE OR REPLACE FUNCTION cleanup_old_pending_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete subscriptions that are in pending_payment status for more than 24 hours
  DELETE FROM subscriptions
  WHERE status = 'pending_payment'
    AND created_at < NOW() - INTERVAL '24 hours';

  -- Log the cleanup action
  RAISE NOTICE 'Cleaned up old pending payment subscriptions at %', NOW();
END;
$$;

-- Schedule the cleanup to run every hour
-- This will automatically clean up any subscriptions older than 24 hours in pending_payment status
SELECT cron.schedule(
  'cleanup-old-pending-subscriptions',  -- Job name
  '0 * * * *',                          -- Run every hour (at minute 0)
  $$SELECT cleanup_old_pending_subscriptions()$$
);

-- You can also call this function manually if needed
-- SELECT cleanup_old_pending_subscriptions();

-- To view scheduled jobs, use:
-- SELECT * FROM cron.job;

-- To unschedule the job (if needed), use:
-- SELECT cron.unschedule('cleanup-old-pending-subscriptions');

COMMENT ON FUNCTION cleanup_old_pending_subscriptions() IS
'Automatically deletes subscription records that have been in pending_payment status for more than 24 hours. This runs every hour via pg_cron.';
