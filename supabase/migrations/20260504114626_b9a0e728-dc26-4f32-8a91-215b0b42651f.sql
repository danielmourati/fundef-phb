ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_created_by_fkey;
DELETE FROM public.messages WHERE id='e4efbb64-0209-4416-8d72-8f6be38da77f';