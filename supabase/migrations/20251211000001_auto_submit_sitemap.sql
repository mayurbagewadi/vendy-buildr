-- Create table to track sitemap submissions
CREATE TABLE IF NOT EXISTS public.sitemap_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  domain text NOT NULL,
  sitemap_url text NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending', -- pending, success, failed
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sitemap_submissions ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to view their own submissions
CREATE POLICY "Users can view their own sitemap submissions"
ON public.sitemap_submissions
FOR SELECT
USING (
  store_id IN (
    SELECT id FROM public.stores WHERE user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS sitemap_submissions_store_id_idx ON public.sitemap_submissions(store_id);
CREATE INDEX IF NOT EXISTS sitemap_submissions_status_idx ON public.sitemap_submissions(status);

-- Create function to auto-submit sitemap when store is created
CREATE OR REPLACE FUNCTION public.auto_submit_sitemap_on_store_create()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if store has subdomain or custom_domain
  IF NEW.subdomain IS NOT NULL OR NEW.custom_domain IS NOT NULL THEN
    -- Insert a pending submission record
    INSERT INTO public.sitemap_submissions (
      store_id,
      domain,
      sitemap_url,
      status
    ) VALUES (
      NEW.id,
      COALESCE(NEW.custom_domain, NEW.subdomain || '.digitaldukandar.in'),
      'https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/generate-sitemap?domain=' ||
        COALESCE(NEW.custom_domain, NEW.subdomain || '.digitaldukandar.in'),
      'pending'
    );

    -- Call Edge Function to submit to Google (async via pg_net extension if available)
    -- This is a placeholder - actual implementation would use Supabase Edge Function webhook
    PERFORM net.http_post(
      url := 'https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/submit-sitemap-to-google',
      body := json_build_object(
        'storeId', NEW.id,
        'domain', COALESCE(NEW.custom_domain, NEW.subdomain || '.digitaldukandar.in')
      )::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new stores
DROP TRIGGER IF EXISTS trigger_auto_submit_sitemap ON public.stores;
CREATE TRIGGER trigger_auto_submit_sitemap
  AFTER INSERT ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_submit_sitemap_on_store_create();

-- Also trigger on UPDATE when subdomain or custom_domain changes
CREATE OR REPLACE FUNCTION public.auto_submit_sitemap_on_domain_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if subdomain or custom_domain changed
  IF (OLD.subdomain IS DISTINCT FROM NEW.subdomain) OR
     (OLD.custom_domain IS DISTINCT FROM NEW.custom_domain) THEN

    IF NEW.subdomain IS NOT NULL OR NEW.custom_domain IS NOT NULL THEN
      -- Insert a pending submission record
      INSERT INTO public.sitemap_submissions (
        store_id,
        domain,
        sitemap_url,
        status
      ) VALUES (
        NEW.id,
        COALESCE(NEW.custom_domain, NEW.subdomain || '.digitaldukandar.in'),
        'https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/generate-sitemap?domain=' ||
          COALESCE(NEW.custom_domain, NEW.subdomain || '.digitaldukandar.in'),
        'pending'
      );

      -- Call Edge Function to submit to Google
      PERFORM net.http_post(
        url := 'https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/submit-sitemap-to-google',
        body := json_build_object(
          'storeId', NEW.id,
          'domain', COALESCE(NEW.custom_domain, NEW.subdomain || '.digitaldukandar.in')
        )::jsonb
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_submit_sitemap_on_update ON public.stores;
CREATE TRIGGER trigger_auto_submit_sitemap_on_update
  AFTER UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_submit_sitemap_on_domain_change();
