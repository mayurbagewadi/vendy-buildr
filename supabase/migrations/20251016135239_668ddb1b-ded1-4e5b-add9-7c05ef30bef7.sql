-- Add Google OAuth credentials to stores table
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS google_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS google_sheet_id TEXT,
ADD COLUMN IF NOT EXISTS google_sheet_url TEXT;

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_landmark TEXT,
  delivery_pincode TEXT,
  delivery_time TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal INTEGER NOT NULL DEFAULT 0,
  delivery_charge INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  payment_method TEXT NOT NULL DEFAULT 'cod',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Orders policies
CREATE POLICY "Store owners can view their orders"
ON orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM stores
    WHERE stores.id = orders.store_id
    AND stores.user_id = auth.uid()
  )
);

CREATE POLICY "Store owners can insert their orders"
ON orders FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stores
    WHERE stores.id = orders.store_id
    AND stores.user_id = auth.uid()
  )
);

CREATE POLICY "Store owners can update their orders"
ON orders FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM stores
    WHERE stores.id = orders.store_id
    AND stores.user_id = auth.uid()
  )
);

-- Add trigger for orders updated_at
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);