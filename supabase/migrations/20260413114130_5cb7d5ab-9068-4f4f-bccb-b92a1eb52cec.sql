
-- Function to verify password (bcrypt compare)
CREATE OR REPLACE FUNCTION public.verify_password(plain_password text, hashed_password text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT hashed_password = extensions.crypt(plain_password, hashed_password);
$$;

-- Function to hash password
CREATE OR REPLACE FUNCTION public.hash_password(plain_password text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT extensions.crypt(plain_password, extensions.gen_salt('bf', 10));
$$;

-- Revoke direct access from client roles
REVOKE EXECUTE ON FUNCTION public.verify_password(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hash_password(text) FROM anon, authenticated;
