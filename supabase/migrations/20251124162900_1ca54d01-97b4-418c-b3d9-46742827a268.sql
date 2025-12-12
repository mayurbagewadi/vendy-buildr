-- Add user_id column to helper_applications table
ALTER TABLE helper_applications
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX idx_helper_applications_user_id ON helper_applications(user_id);