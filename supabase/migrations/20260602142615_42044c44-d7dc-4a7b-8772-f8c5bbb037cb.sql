
-- 1) Drop unused plaintext senha column from professors
ALTER TABLE public.professors DROP COLUMN IF EXISTS senha;

-- 2) Add restrictive deny-all policies for anon + authenticated on all tables.
--    Edge functions use service_role which bypasses RLS.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['contestacoes','login_attempts','message_reads','messages','professors','system_settings','users'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "deny_all_client_access" ON public.%I', t);
    EXECUTE format($p$CREATE POLICY "deny_all_client_access" ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)$p$, t);
    -- Also revoke direct table privileges from anon/authenticated as defense in depth
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END$$;

-- 3) Lock down SECURITY DEFINER helper functions to service_role only
REVOKE ALL ON FUNCTION public.hash_password(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_password(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hash_password(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_password(text, text) TO service_role;
