-- Update handle_new_user() to fire welcome email via pg_net after profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  anon_key text;
  user_full_name text;
BEGIN
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );

  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, user_full_name)
  ON CONFLICT (user_id) DO NOTHING;

  -- Welcome email — wrapped so ANY failure never breaks signup
  BEGIN
    SELECT decrypted_secret INTO anon_key
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_anon_key'
    LIMIT 1;

    IF anon_key IS NOT NULL THEN
      PERFORM pg_net.http_post(
        url := 'https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/send-welcome-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon_key
        ),
        body := jsonb_build_object(
          'record', jsonb_build_object(
            'email', NEW.email,
            'full_name', user_full_name
          )
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but never block signup
    RAISE WARNING 'Welcome email failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;
