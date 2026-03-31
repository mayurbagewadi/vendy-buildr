-- Add offer_price column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_price NUMERIC;
