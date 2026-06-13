ALTER TABLE public.contestacoes
  ADD COLUMN IF NOT EXISTS documento_path text,
  ADD COLUMN IF NOT EXISTS documento_nome text;