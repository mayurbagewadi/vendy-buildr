-- Trigger: auto-sync new stores to superadmin Google Sheet via pg_net
-- Fires AFTER INSERT on stores, calls superadmin-sync-to-sheets edge function
-- Wrapped in exception handler — never blocks store creation on failure

CREATE OR REPLACE FUNCTION public.notify_sheets_on_store_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  anon_key text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO anon_key
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_anon_key'
    LIMIT 1;

    IF anon_key IS NOT NULL THEN
      PERFORM pg_net.http_post(
        url := 'https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/superadmin-sync-to-sheets',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon_key
        ),
        body := jsonb_build_object(
          'action', 'append_store',
          'store_id', NEW.id
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never block store creation — just log warning
    RAISE WARNING '[sheets-trigger] Failed to queue store sync: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Drop if exists (safe re-run)
DROP TRIGGER IF EXISTS on_store_insert_sync_sheets ON public.stores;

CREATE TRIGGER on_store_insert_sync_sheets
  AFTER INSERT ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION notify_sheets_on_store_insert();
