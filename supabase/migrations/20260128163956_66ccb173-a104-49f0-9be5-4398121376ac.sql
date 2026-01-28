-- Add unique constraint on tipos_consultoria.nome to prevent duplicates
ALTER TABLE public.tipos_consultoria 
ADD CONSTRAINT tipos_consultoria_nome_unique UNIQUE (nome);