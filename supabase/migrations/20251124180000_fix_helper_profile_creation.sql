-- Fix: Prevent automatic profile creation for helper applicants
-- Update handle_new_user function to check user_type before creating profile

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Check if this is a helper applicant from user metadata
  -- If user_type is 'helper_applicant', skip profile creation
  IF NEW.raw_user_meta_data->>'user_type' = 'helper_applicant' THEN
    RETURN NEW;
  END IF;

  -- For all other users (store owners, regular users), create profile
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    )
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Clean up existing helper profiles that shouldn't exist
-- Remove profiles for users who are helpers but not store owners
DELETE FROM public.profiles
WHERE user_id IN (
  SELECT h.id
  FROM public.helpers h
  WHERE NOT EXISTS (
    SELECT 1 FROM public.stores s WHERE s.user_id = h.id
  )
);

-- Also remove profiles for helper applicants who are not store owners
DELETE FROM public.profiles
WHERE user_id IN (
  SELECT ha.user_id
  FROM public.helper_applications ha
  WHERE NOT EXISTS (
    SELECT 1 FROM public.stores s WHERE s.user_id = ha.user_id
  )
);
