-- First, update the handle_new_user function to handle OAuth users better
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Insert profile with email from auth metadata
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

-- Create profiles for existing users who don't have them
INSERT INTO public.profiles (user_id, email, full_name)
SELECT 
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name',
    ''
  )
FROM auth.users au
LEFT JOIN public.profiles p ON p.user_id = au.id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;