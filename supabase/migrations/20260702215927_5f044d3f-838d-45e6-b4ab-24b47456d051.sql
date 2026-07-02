
-- Tabela de professores contratados (separada dos efetivos)
CREATE TABLE public.contratados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  matricula TEXT,
  data_nascimento TEXT,
  carga_horaria INTEGER DEFAULT 20,
  total_cotas INTEGER DEFAULT 0,
  cargo TEXT DEFAULT 'PROFESSOR(A) EJA',
  vinculo TEXT NOT NULL DEFAULT 'Contratado',
  status TEXT NOT NULL DEFAULT 'ATIVO',
  senha_hash TEXT,
  role TEXT NOT NULL DEFAULT 'professor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contratados_cpf_matricula_uidx ON public.contratados (cpf, COALESCE(matricula, ''));
CREATE INDEX contratados_cpf_idx ON public.contratados (cpf);
CREATE INDEX contratados_nome_idx ON public.contratados (nome);

GRANT ALL ON public.contratados TO service_role;
ALTER TABLE public.contratados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contratados no client access" ON public.contratados FOR ALL USING (false) WITH CHECK (false);

CREATE TRIGGER update_contratados_updated_at
BEFORE UPDATE ON public.contratados
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Períodos trabalhados (múltiplos por contratado)
CREATE TABLE public.contratado_periodos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contratado_id UUID NOT NULL REFERENCES public.contratados(id) ON DELETE CASCADE,
  inicio TEXT NOT NULL,
  fim TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX contratado_periodos_contratado_idx ON public.contratado_periodos (contratado_id, ordem);

GRANT ALL ON public.contratado_periodos TO service_role;
ALTER TABLE public.contratado_periodos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contratado_periodos no client access" ON public.contratado_periodos FOR ALL USING (false) WITH CHECK (false);

CREATE TRIGGER update_contratado_periodos_updated_at
BEFORE UPDATE ON public.contratado_periodos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
