-- Add explicit diagnostics for browser push dispatch.
-- Order events staying "pending" means dispatch was not observable.
-- This records missing secrets / pg_net failures in delivery logs and provides
-- a manual resend RPC for pending notification_events.

CREATE OR REPLACE FUNCTION public.dispatch_browser_push_event(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  anon_key text;
  internal_secret text;
  request_id bigint;
BEGIN
  SELECT decrypted_secret INTO anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_anon_key'
  LIMIT 1;

  SELECT decrypted_secret INTO internal_secret
  FROM vault.decrypted_secrets
  WHERE name = 'browser_push_internal_secret'
  LIMIT 1;

  IF anon_key IS NULL OR internal_secret IS NULL THEN
    INSERT INTO public.notification_delivery_logs (
      notification_event_id,
      channel,
      status,
      error_message
    )
    VALUES (
      p_event_id,
      'browser_push_dispatch',
      'failed',
      'Missing vault secret: ' ||
        CASE WHEN anon_key IS NULL THEN 'supabase_anon_key ' ELSE '' END ||
        CASE WHEN internal_secret IS NULL THEN 'browser_push_internal_secret' ELSE '' END
    );

    UPDATE public.notification_events
    SET delivery_status = 'failed'
    WHERE id = p_event_id;

    RETURN false;
  END IF;

  BEGIN
    SELECT net.http_post(
      url := 'https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/send-browser-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key,
        'x-internal-secret', internal_secret
      ),
      body := jsonb_build_object(
        'action', 'send_event',
        'eventId', p_event_id
      )
    ) INTO request_id;

    INSERT INTO public.notification_delivery_logs (
      notification_event_id,
      channel,
      status,
      error_message
    )
    VALUES (
      p_event_id,
      'browser_push_dispatch',
      'sent',
      'Queued pg_net request id: ' || request_id::text
    );

    RETURN true;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.notification_delivery_logs (
      notification_event_id,
      channel,
      status,
      error_message
    )
    VALUES (
      p_event_id,
      'browser_push_dispatch',
      'failed',
      SQLERRM
    );

    UPDATE public.notification_events
    SET delivery_status = 'failed'
    WHERE id = p_event_id;

    RETURN false;
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dispatch_browser_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.type = 'test' THEN
    RETURN NEW;
  END IF;

  PERFORM public.dispatch_browser_push_event(NEW.id);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.retry_pending_browser_push_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  event_row record;
  queued_count integer := 0;
BEGIN
  FOR event_row IN
    SELECT id
    FROM public.notification_events
    WHERE delivery_status IN ('pending', 'failed')
      AND type <> 'test'
    ORDER BY created_at DESC
    LIMIT 50
  LOOP
    IF public.dispatch_browser_push_event(event_row.id) THEN
      queued_count := queued_count + 1;
    END IF;
  END LOOP;

  RETURN queued_count;
END;
$function$;
