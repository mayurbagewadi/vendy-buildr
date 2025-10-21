-- Update super admin password to use SHA-256 hash
-- The password "admin123" hashed with SHA-256 is:
-- 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9

UPDATE public.super_admins
SET password_hash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
WHERE email = 'admin@yourplatform.com';