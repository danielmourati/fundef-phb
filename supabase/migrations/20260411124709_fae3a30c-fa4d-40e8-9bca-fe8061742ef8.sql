
-- System settings table (key-value)
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select system_settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Allow insert system_settings" ON public.system_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update system_settings" ON public.system_settings FOR UPDATE USING (true);

CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allow insert/update/delete on professors
CREATE POLICY "Allow anon insert professors" ON public.professors FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow auth insert professors" ON public.professors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow anon update professors" ON public.professors FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow auth update professors" ON public.professors FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow anon delete professors" ON public.professors FOR DELETE TO anon USING (true);
CREATE POLICY "Allow auth delete professors" ON public.professors FOR DELETE TO authenticated USING (true);

-- Allow update on contestacoes
CREATE POLICY "Allow anon update contestacoes" ON public.contestacoes FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow auth update contestacoes" ON public.contestacoes FOR UPDATE TO authenticated USING (true);
