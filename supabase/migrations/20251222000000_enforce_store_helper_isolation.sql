-- ============================================================================
-- CRITICAL DATABASE CONSTRAINT: Prevent Store/Helper Email/Phone Overlap
-- ============================================================================
-- This migration enforces strict isolation between store owners and helpers
-- at the DATABASE LEVEL to prevent CASCADE delete incidents.
--
-- INCIDENT: Store "sasumasale" (mayurmb.mb@gmail.com) was deleted when
-- helper account was removed, causing permanent data loss.
--
-- SOLUTION: Database triggers that REJECT any attempt to use store owner
-- email/phone for helper accounts (and vice versa).
-- ============================================================================

-- ============================================================================
-- FUNCTION 1: Check if email/phone belongs to a store owner
-- ============================================================================
CREATE OR REPLACE FUNCTION check_helper_application_not_store_owner()
RETURNS TRIGGER AS $$
DECLARE
  store_record RECORD;
  profile_user_id UUID;
BEGIN
  -- Check 1: Does this email belong to a store owner?
  SELECT user_id INTO profile_user_id
  FROM profiles
  WHERE email = NEW.email
  LIMIT 1;

  IF profile_user_id IS NOT NULL THEN
    -- Check if this user_id owns a store
    SELECT id, name INTO store_record
    FROM stores
    WHERE user_id = profile_user_id
    LIMIT 1;

    IF store_record IS NOT NULL THEN
      RAISE EXCEPTION 'BLOCKED: Email % is registered as store owner of "%". Store owners cannot become helpers. Use a different email.',
        NEW.email, store_record.name
        USING ERRCODE = '23505'; -- Unique violation error code
    END IF;
  END IF;

  -- Check 2: Does this phone number belong to a store?
  SELECT id, name INTO store_record
  FROM stores
  WHERE whatsapp_number = NEW.phone
  LIMIT 1;

  IF store_record IS NOT NULL THEN
    RAISE EXCEPTION 'BLOCKED: Phone number % is registered for store "%". Store owners cannot become helpers. Use a different phone.',
      NEW.phone, store_record.name
      USING ERRCODE = '23505';
  END IF;

  -- All checks passed - allow insert/update
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION 2: Check if email/phone belongs to a helper
-- ============================================================================
CREATE OR REPLACE FUNCTION check_store_not_helper()
RETURNS TRIGGER AS $$
DECLARE
  helper_record RECORD;
  profile_email TEXT;
BEGIN
  -- Check 1: Does this user_id belong to a helper?
  SELECT id, full_name INTO helper_record
  FROM helpers
  WHERE id = NEW.user_id
  LIMIT 1;

  IF helper_record IS NOT NULL THEN
    RAISE EXCEPTION 'BLOCKED: User % is already registered as helper "%". Helpers cannot create stores with the same account.',
      NEW.user_id, helper_record.full_name
      USING ERRCODE = '23505';
  END IF;

  -- Check 2: Does this user_id have a helper application?
  SELECT id, full_name INTO helper_record
  FROM helper_applications
  WHERE user_id = NEW.user_id
  LIMIT 1;

  IF helper_record IS NOT NULL THEN
    RAISE EXCEPTION 'BLOCKED: User has a pending helper application for "%". Cannot create store while helper application is pending.',
      helper_record.full_name
      USING ERRCODE = '23505';
  END IF;

  -- Check 3: Does this phone number belong to a helper?
  IF NEW.whatsapp_number IS NOT NULL THEN
    SELECT id, full_name INTO helper_record
    FROM helpers h
    WHERE h.phone = NEW.whatsapp_number
    LIMIT 1;

    IF helper_record IS NOT NULL THEN
      RAISE EXCEPTION 'BLOCKED: Phone number % is registered for helper "%". Cannot use same phone for store.',
        NEW.whatsapp_number, helper_record.full_name
        USING ERRCODE = '23505';
    END IF;

    -- Check helper applications too
    SELECT id, full_name INTO helper_record
    FROM helper_applications ha
    WHERE ha.phone = NEW.whatsapp_number
    LIMIT 1;

    IF helper_record IS NOT NULL THEN
      RAISE EXCEPTION 'BLOCKED: Phone number % is registered for helper application "%". Cannot use same phone for store.',
        NEW.whatsapp_number, helper_record.full_name
        USING ERRCODE = '23505';
    END IF;
  END IF;

  -- All checks passed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION 3: Check approved helpers (when moving from application to helper)
-- ============================================================================
CREATE OR REPLACE FUNCTION check_approved_helper_not_store_owner()
RETURNS TRIGGER AS $$
DECLARE
  store_record RECORD;
BEGIN
  -- Check if this user_id owns a store
  SELECT id, name INTO store_record
  FROM stores
  WHERE user_id = NEW.id
  LIMIT 1;

  IF store_record IS NOT NULL THEN
    RAISE EXCEPTION 'BLOCKED: User owns store "%". Cannot approve as helper. Store owners cannot be helpers.',
      store_record.name
      USING ERRCODE = '23505';
  END IF;

  -- Check phone number too
  IF NEW.phone IS NOT NULL THEN
    SELECT id, name INTO store_record
    FROM stores
    WHERE whatsapp_number = NEW.phone
    LIMIT 1;

    IF store_record IS NOT NULL THEN
      RAISE EXCEPTION 'BLOCKED: Phone number % belongs to store "%". Cannot use for helper.',
        NEW.phone, store_record.name
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DROP EXISTING TRIGGERS (if any)
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_check_helper_application_not_store_owner ON helper_applications;
DROP TRIGGER IF EXISTS trigger_check_approved_helper_not_store_owner ON helpers;
DROP TRIGGER IF EXISTS trigger_check_store_not_helper ON stores;

-- ============================================================================
-- TRIGGER 1: Block helper_applications if email/phone belongs to store owner
-- ============================================================================
CREATE TRIGGER trigger_check_helper_application_not_store_owner
  BEFORE INSERT OR UPDATE ON helper_applications
  FOR EACH ROW
  EXECUTE FUNCTION check_helper_application_not_store_owner();

COMMENT ON TRIGGER trigger_check_helper_application_not_store_owner ON helper_applications IS
'Prevents helper applications from using store owner emails/phones. Enforces business rule: Store owners cannot become helpers.';

-- ============================================================================
-- TRIGGER 2: Block helpers table if user owns a store
-- ============================================================================
CREATE TRIGGER trigger_check_approved_helper_not_store_owner
  BEFORE INSERT OR UPDATE ON helpers
  FOR EACH ROW
  EXECUTE FUNCTION check_approved_helper_not_store_owner();

COMMENT ON TRIGGER trigger_check_approved_helper_not_store_owner ON helpers IS
'Prevents approving helpers who own stores. Enforces business rule: Store owners cannot be helpers.';

-- ============================================================================
-- TRIGGER 3: Block stores if user is a helper
-- ============================================================================
CREATE TRIGGER trigger_check_store_not_helper
  BEFORE INSERT OR UPDATE ON stores
  FOR EACH ROW
  EXECUTE FUNCTION check_store_not_helper();

COMMENT ON TRIGGER trigger_check_store_not_helper ON stores IS
'Prevents store creation for helpers. Enforces business rule: Helpers cannot create stores with same account.';

-- ============================================================================
-- INDEXES FOR PERFORMANCE (triggers query these tables frequently)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);
CREATE INDEX IF NOT EXISTS idx_stores_whatsapp_number ON stores(whatsapp_number) WHERE whatsapp_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_helpers_phone ON helpers(phone);
CREATE INDEX IF NOT EXISTS idx_helper_applications_phone ON helper_applications(phone);
CREATE INDEX IF NOT EXISTS idx_helper_applications_email ON helper_applications(email);

-- ============================================================================
-- VERIFICATION QUERIES (for testing)
-- ============================================================================
-- To test if triggers are working:
--
-- 1. Try inserting a helper application with store owner email:
--    INSERT INTO helper_applications (email, phone, ...) VALUES ('store_owner@email.com', ...);
--    -- Should FAIL with: "BLOCKED: Email is registered as store owner"
--
-- 2. Try inserting a store for a helper:
--    INSERT INTO stores (user_id, ...) VALUES (helper_user_id, ...);
--    -- Should FAIL with: "BLOCKED: User is already registered as helper"
-- ============================================================================

-- Log successful migration
DO $$
BEGIN
  RAISE NOTICE '✅ Store/Helper isolation constraints installed successfully';
  RAISE NOTICE '✅ Database-level protection active';
  RAISE NOTICE '✅ Email/phone overlap BLOCKED at database level';
END $$;
