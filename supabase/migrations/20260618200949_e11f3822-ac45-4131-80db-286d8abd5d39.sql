ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS target_type text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS target_roles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_cargos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_user_ids uuid[] NOT NULL DEFAULT '{}';