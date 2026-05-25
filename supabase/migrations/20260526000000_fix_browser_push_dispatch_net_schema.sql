-- Fix browser push dispatch for real order notifications.
-- Supabase pg_net exposes HTTP helpers in the `net` schema, not `pg_net`.
-- Test notifications worked because they call the Edge Function directly;
-- order notifications were created but stayed pending because this trigger
-- could not dispatch them.

CREATE OR REPLACE FUNCTION public.dispatch_browser_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  anon_key text;
  internal_secret text;
BEGIN
  IF NEW.type = 'test' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO anon_key
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_anon_key'
    LIMIT 1;

    SELECT decrypted_secret INTO internal_secret
    FROM vault.decrypted_secrets
    WHERE name = 'browser_push_internal_secret'
    LIMIT 1;

    IF anon_key IS NOT NULL AND internal_secret IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/send-browser-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon_key,
          'x-internal-secret', internal_secret
        ),
        body := jsonb_build_object(
          'action', 'send_event',
          'eventId', NEW.id
        )
      );
    ELSE
      RAISE WARNING 'Browser push dispatch skipped: missing supabase_anon_key or browser_push_internal_secret vault secret';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Browser push dispatch failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;
