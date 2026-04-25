-- Add delivery fee columns to stores table
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS delivery_fee_amount NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS free_delivery_above NUMERIC(10,2) DEFAULT NULL;
