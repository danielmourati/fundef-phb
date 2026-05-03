-- Update admin and juridico users with proper email/password
UPDATE public.users SET email = 'dmouraphb@gmail.com', senha_hash = public.hash_password('seduc@123') WHERE role = 'admin';
UPDATE public.users SET email = 'juridico@gmail.com', senha_hash = public.hash_password('seduc@123') WHERE role = 'juridico';

-- Ensure unique email
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON public.users (lower(email)) WHERE email IS NOT NULL;