-- Create the approve_helper_application RPC function
-- This function handles approving helper applications and creating helper records

CREATE OR REPLACE FUNCTION public.approve_helper_application(p_application_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application helper_applications%ROWTYPE;
  v_helper_id UUID;
  v_referral_code TEXT;
  v_store_referral_link TEXT;
  v_helper_recruitment_link TEXT;
BEGIN
  -- Get the application details
  SELECT * INTO v_application
  FROM public.helper_applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Application not found'
    );
  END IF;

  -- Check if already approved
  IF v_application.application_status = 'Approved' THEN
    -- Get the existing helper record
    SELECT id, referral_code INTO v_helper_id, v_referral_code
    FROM public.helpers
    WHERE application_id = p_application_id;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Application already approved',
        'referralCode', v_referral_code,
        'helperId', v_helper_id
      );
    END IF;
  END IF;

  -- Generate referral code
  v_referral_code := public.generate_referral_code();

  -- Build referral links
  v_store_referral_link := 'https://yesgive.shop/auth?ref=' || v_referral_code;
  v_helper_recruitment_link := 'https://yesgive.shop/become-helper?ref=' || v_referral_code;

  -- Create helper record
  INSERT INTO public.helpers (
    application_id,
    id,
    full_name,
    email,
    phone,
    referral_code,
    store_referral_link,
    helper_recruitment_link,
    recruited_by_helper_id,
    status,
    direct_commission_rate,
    network_commission_rate
  ) VALUES (
    p_application_id,
    v_application.user_id, -- Use the same user_id from application
    v_application.full_name,
    v_application.email,
    v_application.phone,
    v_referral_code,
    v_store_referral_link,
    v_helper_recruitment_link,
    v_application.recruited_by_helper_id,
    'Active',
    10, -- Default 10% direct commission
    5   -- Default 5% network commission
  )
  RETURNING id INTO v_helper_id;

  -- Update application status
  UPDATE public.helper_applications
  SET
    application_status = 'Approved',
    approved_at = NOW()
  WHERE id = p_application_id;

  -- Return success with helper details
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Helper approved successfully',
    'helperId', v_helper_id,
    'referralCode', v_referral_code,
    'storeReferralLink', v_store_referral_link,
    'helperRecruitmentLink', v_helper_recruitment_link
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Helper with this email or phone already exists'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users (superadmin will use this)
GRANT EXECUTE ON FUNCTION public.approve_helper_application(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.approve_helper_application IS 'Approves a helper application and creates a helper record with referral codes';
