ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS gsc_verification_token TEXT;
