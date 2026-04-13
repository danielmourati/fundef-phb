
-- Enable pgcrypto for bcrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add senha_hash column
ALTER TABLE public.professors ADD COLUMN IF NOT EXISTS senha_hash text;

-- Hash all existing plain-text passwords
UPDATE public.professors SET senha_hash = crypt(senha, gen_salt('bf', 10)) WHERE senha_hash IS NULL AND senha IS NOT NULL;

-- Create login_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  matricula text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
-- No RLS policies = no access from client (only service role)

-- Create index for rate limiting lookups
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created ON public.login_attempts (ip_address, created_at);

-- ============================================================
-- DROP ALL OPEN RLS POLICIES
-- ============================================================

-- professors
DROP POLICY IF EXISTS "Allow anon delete professors" ON public.professors;
DROP POLICY IF EXISTS "Allow anon insert professors" ON public.professors;
DROP POLICY IF EXISTS "Allow anon select professors" ON public.professors;
DROP POLICY IF EXISTS "Allow anon update professors" ON public.professors;
DROP POLICY IF EXISTS "Allow auth delete professors" ON public.professors;
DROP POLICY IF EXISTS "Allow auth insert professors" ON public.professors;
DROP POLICY IF EXISTS "Allow auth select professors" ON public.professors;
DROP POLICY IF EXISTS "Allow auth update professors" ON public.professors;

-- contestacoes
DROP POLICY IF EXISTS "Allow anon insert contestacoes" ON public.contestacoes;
DROP POLICY IF EXISTS "Allow anon select contestacoes" ON public.contestacoes;
DROP POLICY IF EXISTS "Allow anon update contestacoes" ON public.contestacoes;
DROP POLICY IF EXISTS "Allow auth insert contestacoes" ON public.contestacoes;
DROP POLICY IF EXISTS "Allow auth select contestacoes" ON public.contestacoes;
DROP POLICY IF EXISTS "Allow auth update contestacoes" ON public.contestacoes;

-- system_settings
DROP POLICY IF EXISTS "Allow insert system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow select system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow update system_settings" ON public.system_settings;

-- ============================================================
-- NO NEW CLIENT-FACING POLICIES
-- All access goes through Edge Functions using service_role key
-- ============================================================
