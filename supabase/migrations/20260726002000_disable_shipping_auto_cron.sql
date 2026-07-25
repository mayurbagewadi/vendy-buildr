-- Free-plan guardrail: shipping tracking is refreshed by explicit admin action only.
-- If the old cron migration was already applied, this safely stops it.

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT cron.unschedule($1)' USING 'delhivery-tracking-sync-30min';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    BEGIN
      EXECUTE 'SELECT cron.unschedule($1)' USING 'shipping-notification-worker-5min';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;
