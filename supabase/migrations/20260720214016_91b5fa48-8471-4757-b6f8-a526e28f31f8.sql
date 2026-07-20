ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS arquivado_em timestamptz,
  ADD COLUMN IF NOT EXISTS arquivado_por uuid;

CREATE INDEX IF NOT EXISTS idx_projetos_arquivado_em ON public.projetos (arquivado_em);