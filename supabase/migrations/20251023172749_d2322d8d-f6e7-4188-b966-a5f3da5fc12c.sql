-- Add policies and address fields to stores table
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS policies jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS address text;

-- Add comment
COMMENT ON COLUMN public.stores.policies IS 'Store policies including privacy_policy, terms_conditions, return_policy, shipping_policy';
COMMENT ON COLUMN public.stores.address IS 'Store physical address';