-- Migration: Add store_id to store_referrals table for proper referral tracking
-- Purpose: Link referral records to actual stores created via referral codes
-- Author: Enterprise Developer (20+ years experience)
-- Date: 2025-12-16

-- Step 1: Add store_id column (nullable first for existing data)
ALTER TABLE public.store_referrals
ADD COLUMN store_id UUID;

-- Step 2: Add foreign key constraint with CASCADE delete
-- When a store is deleted, the referral record should also be deleted
ALTER TABLE public.store_referrals
ADD CONSTRAINT store_referrals_store_id_fkey
FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;

-- Step 3: Create index for performance optimization
-- Helper Dashboard queries will filter by helper_id and join on store_id
CREATE INDEX idx_store_referrals_store_id ON public.store_referrals(store_id);
CREATE INDEX idx_store_referrals_helper_store ON public.store_referrals(helper_id, store_id);

-- Step 4: Add comment for documentation
COMMENT ON COLUMN public.store_referrals.store_id IS
'Foreign key to stores table - links referral to the actual store created';

-- Step 5: Update RLS policy to allow store owners to view their referral info
CREATE POLICY "Store owners can view their referral info"
  ON public.store_referrals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_referrals.store_id
      AND stores.user_id = auth.uid()
    )
  );

-- Step 6: Add policy to allow inserting referrals during store creation
CREATE POLICY "Allow inserting referrals during store setup"
  ON public.store_referrals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_referrals.store_id
      AND stores.user_id = auth.uid()
    )
  );

-- Note: For existing referral records without store_id, manual backfill may be needed
-- This can be done by matching store_owner_email with stores.user_id -> auth.users.email
