CREATE TABLE public.record_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.record_changes TO service_role;

ALTER TABLE public.record_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY deny_all_client_access ON public.record_changes
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE INDEX record_changes_changed_at_idx ON public.record_changes (changed_at DESC);
CREATE INDEX record_changes_record_idx ON public.record_changes (record_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_record_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f text;
  old_v text;
  new_v text;
  fields text[] := ARRAY['nome','cpf','matricula','data_nascimento','carga_horaria','cargo','total_cotas','status','vinculo','vinculo_inicio','vinculo_fim','role'];
  old_j jsonb := to_jsonb(OLD);
  new_j jsonb := to_jsonb(NEW);
BEGIN
  FOREACH f IN ARRAY fields LOOP
    IF old_j ? f AND new_j ? f THEN
      old_v := old_j ->> f;
      new_v := new_j ->> f;
      IF coalesce(old_v, '') <> coalesce(new_v, '') THEN
        INSERT INTO public.record_changes (table_name, record_id, field, old_value, new_value)
        VALUES (TG_TABLE_NAME, NEW.id, f, old_v, new_v);
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_professors_changes
  AFTER UPDATE ON public.professors
  FOR EACH ROW EXECUTE FUNCTION public.log_record_changes();

CREATE TRIGGER log_contratados_changes
  AFTER UPDATE ON public.contratados
  FOR EACH ROW EXECUTE FUNCTION public.log_record_changes();