-- Create Super Admin User
-- This migration creates a super admin user with credentials

DO $$
DECLARE
  new_user_id uuid;
  user_email text := 'admin@yesgive.shop';
  user_password text := 'Admin@123456'; -- CHANGE THIS PASSWORD AFTER FIRST LOGIN
  user_full_name text := 'Super Admin';
BEGIN
  -- Check if user already exists
  SELECT id INTO new_user_id
  FROM auth.users
  WHERE email = user_email;

  -- Create user if doesn't exist
  IF new_user_id IS NULL THEN
    -- Insert into auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      user_email,
      crypt(user_password, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', user_full_name),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO new_user_id;

    -- Insert into profiles
    INSERT INTO public.profiles (
      user_id,
      full_name,
      created_at,
      updated_at
    ) VALUES (
      new_user_id,
      user_full_name,
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- Insert super_admin role
    INSERT INTO public.user_roles (
      user_id,
      role,
      created_at
    ) VALUES (
      new_user_id,
      'super_admin',
      NOW()
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Super admin user created successfully with email: %', user_email;
    RAISE NOTICE 'User ID: %', new_user_id;
    RAISE NOTICE 'IMPORTANT: Change the password after first login!';
  ELSE
    RAISE NOTICE 'User with email % already exists with ID: %', user_email, new_user_id;

    -- Ensure the user has super_admin role
    INSERT INTO public.user_roles (
      user_id,
      role,
      created_at
    ) VALUES (
      new_user_id,
      'super_admin',
      NOW()
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Ensured super_admin role is assigned';
  END IF;
END $$;
