CREATE TABLE public.import_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL,
  file_name text,
  executed_by uuid,
  executed_by_name text,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.import_logs TO service_role;

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_all_client_access" ON public.import_logs
AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE INDEX idx_import_logs_created_at ON public.import_logs (created_at DESC);
CREATE INDEX idx_import_logs_tipo ON public.import_logs (tipo);

CREATE TRIGGER update_import_logs_updated_at
BEFORE UPDATE ON public.import_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();