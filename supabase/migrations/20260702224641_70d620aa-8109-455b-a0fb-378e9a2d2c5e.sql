
-- 1) Permitir contestações de contratados: professor_id passa a ser opcional,
--    contratado_id (novo) aponta para public.contratados. Exatamente um dos dois deve estar preenchido.
ALTER TABLE public.contestacoes ALTER COLUMN professor_id DROP NOT NULL;

ALTER TABLE public.contestacoes
  ADD COLUMN IF NOT EXISTS contratado_id uuid REFERENCES public.contratados(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS contestacoes_contratado_id_idx ON public.contestacoes(contratado_id);

ALTER TABLE public.contestacoes
  DROP CONSTRAINT IF EXISTS contestacoes_owner_chk;
ALTER TABLE public.contestacoes
  ADD CONSTRAINT contestacoes_owner_chk
  CHECK ((professor_id IS NOT NULL)::int + (contratado_id IS NOT NULL)::int = 1);

-- 2) message_reads: mesma ideia — professor_id fica opcional, contratado_id novo.
ALTER TABLE public.message_reads ALTER COLUMN professor_id DROP NOT NULL;

ALTER TABLE public.message_reads
  ADD COLUMN IF NOT EXISTS contratado_id uuid REFERENCES public.contratados(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS message_reads_message_contratado_key
  ON public.message_reads(message_id, contratado_id)
  WHERE contratado_id IS NOT NULL;

ALTER TABLE public.message_reads
  DROP CONSTRAINT IF EXISTS message_reads_owner_chk;
ALTER TABLE public.message_reads
  ADD CONSTRAINT message_reads_owner_chk
  CHECK ((professor_id IS NOT NULL)::int + (contratado_id IS NOT NULL)::int = 1);
