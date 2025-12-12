-- Create helper_applications table
CREATE TABLE public.helper_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  why_helper TEXT NOT NULL,
  bank_account_name TEXT NOT NULL,
  bank_account_number TEXT NOT NULL,
  bank_ifsc_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  application_status TEXT NOT NULL DEFAULT 'Pending',
  rejection_reason TEXT,
  recruited_by_helper_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by_admin TEXT
);

-- Create helpers table
CREATE TABLE public.helpers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.helper_applications(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  store_referral_link TEXT NOT NULL,
  helper_recruitment_link TEXT NOT NULL,
  recruited_by_helper_id UUID REFERENCES public.helpers(id),
  status TEXT NOT NULL DEFAULT 'Active',
  direct_commission_rate INTEGER DEFAULT 10,
  network_commission_rate INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create store_referrals table
CREATE TABLE public.store_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  helper_id UUID REFERENCES public.helpers(id) ON DELETE CASCADE NOT NULL,
  store_owner_name TEXT NOT NULL,
  store_owner_email TEXT NOT NULL,
  store_owner_phone TEXT NOT NULL,
  signup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  trial_start_date DATE,
  trial_end_date DATE,
  trial_status TEXT DEFAULT 'Active',
  subscription_purchased BOOLEAN DEFAULT FALSE,
  subscription_plan TEXT,
  subscription_amount INTEGER,
  purchase_date DATE,
  commission_amount INTEGER,
  commission_status TEXT DEFAULT 'Not Applicable',
  payment_date DATE,
  payment_reference TEXT
);

-- Create network_commissions table
CREATE TABLE public.network_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  earning_helper_id UUID REFERENCES public.helpers(id) ON DELETE CASCADE NOT NULL,
  recruiting_helper_id UUID REFERENCES public.helpers(id) ON DELETE CASCADE NOT NULL,
  direct_commission_amount INTEGER NOT NULL,
  network_commission_amount INTEGER NOT NULL,
  store_referral_id UUID REFERENCES public.store_referrals(id) ON DELETE CASCADE NOT NULL,
  commission_status TEXT DEFAULT 'Earned-Pending',
  payment_date DATE,
  payment_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create function to generate referral codes
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(referral_code FROM 5) AS INTEGER)), 0) + 1
  INTO code_num
  FROM public.helpers;
  
  new_code := 'HELP' || LPAD(code_num::TEXT, 3, '0');
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE public.helper_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_commissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for helper_applications
CREATE POLICY "Anyone can insert applications"
  ON public.helper_applications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view their own application"
  ON public.helper_applications FOR SELECT
  USING (email = current_setting('request.jwt.claims', true)::json->>'email' OR true);

CREATE POLICY "Super admins can manage all applications"
  ON public.helper_applications FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- RLS Policies for helpers
CREATE POLICY "Helpers can view their own profile"
  ON public.helpers FOR SELECT
  USING (email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY "Super admins can manage all helpers"
  ON public.helpers FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- RLS Policies for store_referrals
CREATE POLICY "Helpers can view their referrals"
  ON public.store_referrals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.helpers
      WHERE helpers.id = store_referrals.helper_id
      AND helpers.email = current_setting('request.jwt.claims', true)::json->>'email'
    )
  );

CREATE POLICY "Super admins can manage all referrals"
  ON public.store_referrals FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- RLS Policies for network_commissions
CREATE POLICY "Helpers can view their commissions"
  ON public.network_commissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.helpers
      WHERE (helpers.id = network_commissions.earning_helper_id
      OR helpers.id = network_commissions.recruiting_helper_id)
      AND helpers.email = current_setting('request.jwt.claims', true)::json->>'email'
    )
  );

CREATE POLICY "Super admins can manage all commissions"
  ON public.network_commissions FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));