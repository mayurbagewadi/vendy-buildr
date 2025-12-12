-- Add user_id column to helper_applications table
ALTER TABLE public.helper_applications
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_helper_applications_user_id
ON public.helper_applications(user_id);

-- Update RLS policy to allow users to view their own applications by user_id
DROP POLICY IF EXISTS "Anyone can view their own application" ON public.helper_applications;

CREATE POLICY "Users can view their own application"
  ON public.helper_applications FOR SELECT
  USING (
    user_id = auth.uid()
    OR email = current_setting('request.jwt.claims', true)::json->>'email'
  );
