
-- Messages table for mass messaging
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES public.professors(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Message reads tracking
CREATE TABLE public.message_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  professor_id UUID NOT NULL REFERENCES public.professors(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, professor_id)
);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

-- Add protocolo and resposta to contestacoes
ALTER TABLE public.contestacoes 
  ADD COLUMN protocolo TEXT,
  ADD COLUMN resposta TEXT;

-- Create sequence for protocol numbers
CREATE SEQUENCE public.contestacao_protocolo_seq START 1;

-- Function to auto-generate protocolo on insert
CREATE OR REPLACE FUNCTION public.generate_protocolo()
RETURNS TRIGGER AS $$
BEGIN
  NEW.protocolo := 'CONT-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(nextval('public.contestacao_protocolo_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_protocolo
  BEFORE INSERT ON public.contestacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_protocolo();

-- Triggers for updated_at
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
