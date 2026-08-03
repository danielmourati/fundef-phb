ALTER TABLE public.professors ALTER COLUMN carga_horaria TYPE text USING NULLIF(carga_horaria::text, '');
ALTER TABLE public.professors ALTER COLUMN carga_horaria SET DEFAULT NULL;
ALTER TABLE public.contratados ALTER COLUMN carga_horaria TYPE text USING NULLIF(carga_horaria::text, '');
ALTER TABLE public.contratados ALTER COLUMN carga_horaria SET DEFAULT '20';