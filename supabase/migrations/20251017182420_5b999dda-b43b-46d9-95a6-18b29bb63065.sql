-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the cleanup function to run on the 1st of every month at 2:00 AM
SELECT cron.schedule(
  'cleanup-old-orders-monthly',
  '0 2 1 * *', -- At 2:00 AM on the 1st of every month
  $$
  SELECT
    net.http_post(
        url:='https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/cleanup-old-orders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleGV1eHN2Y2twZnZ1eHFjaHF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMjQ3ODAsImV4cCI6MjA3MzgwMDc4MH0.QxgG18mgyBiB-JnKa3FLUXU_4slv1RQxTX9ruFLVf_c"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);