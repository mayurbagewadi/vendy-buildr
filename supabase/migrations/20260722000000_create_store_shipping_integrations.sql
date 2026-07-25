-- Generic per-store shipping provider credentials.
-- Credentials are encrypted by the Edge Function before insert/update.

CREATE TABLE IF NOT EXISTS public.store_shipping_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  display_name TEXT,
  encrypted_api_token TEXT,
  token_last4 TEXT,
  auth_scheme TEXT NOT NULL DEFAULT 'Token',
  client_name TEXT,
  pickup_location TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'not_connected',
  last_tested_at TIMESTAMPTZ,
  last_error TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT store_shipping_integrations_provider_check
    CHECK (provider IN ('delhivery', 'shiprocket')),
  CONSTRAINT store_shipping_integrations_environment_check
    CHECK (environment IN ('production', 'staging')),
  CONSTRAINT store_shipping_integrations_status_check
    CHECK (status IN ('not_connected', 'connected', 'invalid', 'disabled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS store_shipping_integrations_store_provider_idx
  ON public.store_shipping_integrations(store_id, provider);

CREATE INDEX IF NOT EXISTS store_shipping_integrations_store_enabled_idx
  ON public.store_shipping_integrations(store_id, enabled);

DROP TRIGGER IF EXISTS update_store_shipping_integrations_updated_at
  ON public.store_shipping_integrations;

CREATE TRIGGER update_store_shipping_integrations_updated_at
  BEFORE UPDATE ON public.store_shipping_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.store_shipping_integrations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.store_shipping_integrations IS
  'Per-store shipping provider connection state. Provider credentials are encrypted server-side and never exposed to the browser.';
