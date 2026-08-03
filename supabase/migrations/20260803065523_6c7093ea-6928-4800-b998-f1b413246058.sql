ALTER TABLE public.professors ADD COLUMN IF NOT EXISTS senha_definida boolean NOT NULL DEFAULT false;
ALTER TABLE public.contratados ADD COLUMN IF NOT EXISTS senha_definida boolean NOT NULL DEFAULT false;

-- Rotate admin/juridico credentials previously committed in plaintext in migrations
UPDATE public.users SET senha_hash = public.hash_password('Sd7#Kq2vRm9!Lp4Z') WHERE role = 'admin';
UPDATE public.users SET senha_hash = public.hash_password('Jr5$Nt8wXb3!Qv6Y') WHERE role = 'juridico';