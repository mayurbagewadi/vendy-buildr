-- Drop the foreign key constraint that's causing issues with helper applications
-- The user_id should be nullable and not require a foreign key to auth.users
-- since users need to confirm their email before being fully created

ALTER TABLE public.helper_applications 
DROP CONSTRAINT IF EXISTS helper_applications_user_id_fkey;

-- Add a comment to document why we don't have a foreign key here
COMMENT ON COLUMN public.helper_applications.user_id IS 
'References auth.users.id but without foreign key constraint to allow applications before email confirmation';
