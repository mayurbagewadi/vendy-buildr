-- Add force_location_sharing field to stores table
-- This allows store owners to control whether location sharing is mandatory or optional for customers

ALTER TABLE stores
ADD COLUMN IF NOT EXISTS force_location_sharing BOOLEAN DEFAULT false;

COMMENT ON COLUMN stores.force_location_sharing IS 'When true, customers must share location (mandatory). When false, location sharing is optional.';
