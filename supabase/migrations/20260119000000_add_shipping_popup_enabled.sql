-- Add shipping_popup_enabled field to stores table
-- When enabled: clicking truck icon in Orders opens popup with shipping options
-- When disabled: clicking truck icon directly marks order as delivered
ALTER TABLE stores ADD COLUMN IF NOT EXISTS shipping_popup_enabled BOOLEAN DEFAULT false;
