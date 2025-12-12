-- Fix auto-assignment of subscription plans for new users
-- Add INSERT policy so users can create their own subscription during onboarding

-- Add policy for users to insert their own subscription
CREATE POLICY "Users can insert their own subscription"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Note: This enables the auto-assignment logic in src/pages/onboarding/StoreSetup.tsx
-- When a new user signs up, the default plan (is_default_plan = true) will be automatically assigned
