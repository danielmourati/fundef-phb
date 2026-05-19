DROP INDEX IF EXISTS public.professors_matricula_cpf_key;
CREATE UNIQUE INDEX professors_matricula_cpf_key ON public.professors (matricula, cpf);