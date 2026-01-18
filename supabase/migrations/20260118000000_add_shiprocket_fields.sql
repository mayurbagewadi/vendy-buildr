-- Add Shiprocket fields to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS shiprocket_email TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS shiprocket_token TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS shiprocket_pickup_location TEXT;

-- Add default package dimensions
ALTER TABLE stores ADD COLUMN IF NOT EXISTS package_length DECIMAL(10,2) DEFAULT 10;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS package_breadth DECIMAL(10,2) DEFAULT 10;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS package_height DECIMAL(10,2) DEFAULT 10;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS package_weight DECIMAL(10,2) DEFAULT 0.5;

-- Add shipping fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_shipment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS awb_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
