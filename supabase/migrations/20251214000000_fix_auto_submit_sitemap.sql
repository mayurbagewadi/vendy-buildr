-- Fix auto-submit sitemap to use correct sitemap URLs
-- Previous version used edge function URL instead of actual sitemap URL

-- Update existing function for new stores
CREATE OR REPLACE FUNCTION public.auto_submit_sitemap_on_store_create()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if store has subdomain or custom_domain
  IF NEW.subdomain IS NOT NULL OR NEW.custom_domain IS NOT NULL THEN
    DECLARE
      store_domain TEXT;
      store_sitemap_url TEXT;
    BEGIN
      -- Determine the actual store domain
      store_domain := COALESCE(NEW.custom_domain, NEW.subdomain || '.digitaldukandar.in');

      -- Use the ACTUAL sitemap URL (not edge function URL)
      store_sitemap_url := 'https://' || store_domain || '/sitemap.xml';

      -- Insert a pending submission record
      INSERT INTO public.sitemap_submissions (
        store_id,
        domain,
        sitemap_url,
        status
      ) VALUES (
        NEW.id,
        store_domain,
        store_sitemap_url,  -- FIXED: Using actual sitemap URL
        'pending'
      );

      -- Call Edge Function to submit to Google (async via pg_net extension)
      -- Only if pg_net extension is available
      BEGIN
        PERFORM net.http_post(
          url := 'https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/submit-sitemap-to-google',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleGV1eHN2Y2twZnZ1eHFjaHF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMjQ3ODAsImV4cCI6MjA3MzgwMDc4MH0.QxgG18mgyBiB-JnKa3FLUXU_4slv1RQxTX9ruFLVf_c"}'::jsonb,
          body := json_build_object(
            'storeId', NEW.id,
            'domain', store_domain
          )::jsonb
        );
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the trigger
        RAISE WARNING 'Failed to auto-submit sitemap for store %: %', NEW.id, SQLERRM;
      END;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing function for domain changes
CREATE OR REPLACE FUNCTION public.auto_submit_sitemap_on_domain_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if subdomain or custom_domain changed
  IF (OLD.subdomain IS DISTINCT FROM NEW.subdomain) OR
     (OLD.custom_domain IS DISTINCT FROM NEW.custom_domain) THEN

    IF NEW.subdomain IS NOT NULL OR NEW.custom_domain IS NOT NULL THEN
      DECLARE
        store_domain TEXT;
        store_sitemap_url TEXT;
      BEGIN
        -- Determine the actual store domain
        store_domain := COALESCE(NEW.custom_domain, NEW.subdomain || '.digitaldukandar.in');

        -- Use the ACTUAL sitemap URL (not edge function URL)
        store_sitemap_url := 'https://' || store_domain || '/sitemap.xml';

        -- Insert a pending submission record
        INSERT INTO public.sitemap_submissions (
          store_id,
          domain,
          sitemap_url,
          status
        ) VALUES (
          NEW.id,
          store_domain,
          store_sitemap_url,  -- FIXED: Using actual sitemap URL
          'pending'
        );

        -- Call Edge Function to submit to Google
        BEGIN
          PERFORM net.http_post(
            url := 'https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/submit-sitemap-to-google',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleGV1eHN2Y2twZnZ1eHFjaHF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMjQ3ODAsImV4cCI6MjA3MzgwMDc4MH0.QxgG18mgyBiB-JnKa3FLUXU_4slv1RQxTX9ruFLVf_c"}'::jsonb,
            body := json_build_object(
              'storeId', NEW.id,
              'domain', store_domain
            )::jsonb
          );
        EXCEPTION WHEN OTHERS THEN
          -- Log error but don't fail the trigger
          RAISE WARNING 'Failed to auto-submit sitemap for store %: %', NEW.id, SQLERRM;
        END;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment explaining the fix
COMMENT ON FUNCTION public.auto_submit_sitemap_on_store_create() IS
  'Auto-submits store sitemap to Google Search Console when store is created.
   Uses actual sitemap URL (https://domain/sitemap.xml) instead of edge function URL.';

COMMENT ON FUNCTION public.auto_submit_sitemap_on_domain_change() IS
  'Auto-submits store sitemap to Google Search Console when domain changes.
   Uses actual sitemap URL (https://domain/sitemap.xml) instead of edge function URL.';
