-- ============================================================
-- 1. Create users table (centralized auth credentials)
-- ============================================================
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf TEXT UNIQUE,
  email TEXT UNIQUE,
  senha_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'professor',
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- No client-facing RLS policies; all access via service_role through Edge Functions

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. Add user_id column to professors
-- ============================================================
ALTER TABLE public.professors ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);

-- ============================================================
-- 3. Migrate existing data: create users from professors
-- ============================================================

-- For each distinct CPF, pick the first professor record (by created_at)
-- and create a user with their senha_hash and role
INSERT INTO public.users (cpf, senha_hash, role, status)
SELECT DISTINCT ON (p.cpf)
  p.cpf,
  COALESCE(p.senha_hash, extensions.crypt(p.senha, extensions.gen_salt('bf', 10))),
  p.role,
  CASE WHEN p.status = 'Inativo' THEN 'Inativo' ELSE 'Ativo' END
FROM public.professors p
ORDER BY p.cpf, p.created_at ASC;

-- Link professors to their users via CPF
UPDATE public.professors p
SET user_id = u.id
FROM public.users u
WHERE u.cpf = p.cpf;

-- ============================================================
-- 4. Remove CPF UNIQUE constraint from professors
-- (allows multiple matrículas for same CPF)
-- ============================================================
ALTER TABLE public.professors DROP CONSTRAINT IF EXISTS professors_cpf_key;

-- ============================================================
-- 5. Add email for admin/juridico users (placeholder)
-- They'll need to update via admin panel
-- ============================================================
UPDATE public.users
SET email = cpf || '@placeholder.seduc.phb'
WHERE role = 'juridico';

UPDATE public.users
SET email = 'dmouraphb@gmail.com',
    senha_hash = extensions.crypt('admin@123', extensions.gen_salt('bf', 10))
WHERE id IN (
  SELECT id FROM public.users WHERE role = 'admin' LIMIT 1
);

-- ============================================================
-- 6. Index for fast login lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_cpf ON public.users (cpf);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_professors_user_id ON public.professors (user_id);

-- ============================================================
-- 7. Update login_attempts to support both cpf and email
-- ============================================================
ALTER TABLE public.login_attempts ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE public.login_attempts ADD COLUMN IF NOT EXISTS email TEXT;
