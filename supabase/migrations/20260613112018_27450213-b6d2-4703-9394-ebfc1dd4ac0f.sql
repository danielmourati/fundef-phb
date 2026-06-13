
CREATE SEQUENCE IF NOT EXISTS public.access_report_protocolo_seq;

CREATE TABLE public.access_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo text NOT NULL,
  cpf text NOT NULL,
  tipo_vinculo text NOT NULL,
  whatsapp text NOT NULL,
  email text,
  assunto text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'Aberto',
  resposta_admin text,
  protocolo text,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.access_reports TO service_role;

ALTER TABLE public.access_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY deny_all_client_access ON public.access_reports
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.generate_access_report_protocolo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.protocolo := 'ACC-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(nextval('public.access_report_protocolo_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_access_report_protocolo
  BEFORE INSERT ON public.access_reports
  FOR EACH ROW
  WHEN (NEW.protocolo IS NULL)
  EXECUTE FUNCTION public.generate_access_report_protocolo();

CREATE TRIGGER update_access_reports_updated_at
  BEFORE UPDATE ON public.access_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
