-- Create store activity logs table
CREATE TABLE IF NOT EXISTS public.store_activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('active', 'inactive')),
  reason text NOT NULL,
  last_order_date timestamp with time zone,
  last_admin_visit timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_activity_logs ENABLE ROW LEVEL SECURITY;

-- Super admin can view all logs
CREATE POLICY "Super admin can view all activity logs"
ON public.store_activity_logs
FOR SELECT
USING (true);

-- Super admin can manage all logs
CREATE POLICY "Super admin can manage activity logs"
ON public.store_activity_logs
FOR ALL
USING (true);

-- Create index for better query performance
CREATE INDEX idx_store_activity_logs_store_id ON public.store_activity_logs(store_id);
CREATE INDEX idx_store_activity_logs_status ON public.store_activity_logs(status);
CREATE INDEX idx_store_activity_logs_created_at ON public.store_activity_logs(created_at);