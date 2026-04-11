CREATE TABLE public.professors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  matricula TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  data_nascimento TEXT,
  vinculo_inicio TEXT,
  vinculo_fim TEXT,
  total_cotas INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pendente',
  role TEXT NOT NULL DEFAULT 'professor',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.contestacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professor_id UUID NOT NULL REFERENCES public.professors(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  whatsapp TEXT,
  status TEXT NOT NULL DEFAULT 'Aberta',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.professors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contestacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select professors" ON public.professors
  FOR SELECT TO anon USING (true);
CREATE POLICY "Allow auth select professors" ON public.professors
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow anon insert contestacoes" ON public.contestacoes
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select contestacoes" ON public.contestacoes
  FOR SELECT TO anon USING (true);
CREATE POLICY "Allow auth insert contestacoes" ON public.contestacoes
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow auth select contestacoes" ON public.contestacoes
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_professors_updated_at
  BEFORE UPDATE ON public.professors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contestacoes_updated_at
  BEFORE UPDATE ON public.contestacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.professors (nome, cpf, matricula, senha, data_nascimento, vinculo_inicio, vinculo_fim, total_cotas, status, role)
VALUES ('Administrador', '00000000000', '1013247', '10111989', '10/11/1989', '01/2001', '12/2003', 36, 'Validado', 'admin');

INSERT INTO public.professors (nome, cpf, matricula, senha, data_nascimento, vinculo_inicio, vinculo_fim, total_cotas, status, role)
VALUES ('Daniel Moura', '03797957360', '1013246', '01011980', '01/01/1980', '01/2001', '12/2003', 36, 'Validado', 'professor');