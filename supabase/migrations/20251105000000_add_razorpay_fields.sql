-- Add Razorpay-specific fields to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS razorpay_order_id text,
ADD COLUMN IF NOT EXISTS razorpay_signature text;

-- Add comment
COMMENT ON COLUMN public.transactions.razorpay_order_id IS 'Razorpay order ID for payment verification';
COMMENT ON COLUMN public.transactions.razorpay_signature IS 'Razorpay signature for payment verification';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_razorpay_order_id ON public.transactions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_id ON public.transactions(payment_id);
