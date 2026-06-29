CREATE TABLE IF NOT EXISTS public.agentes_ia_rascunhos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  estado jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cliente_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agentes_ia_rascunhos TO authenticated;
GRANT ALL ON public.agentes_ia_rascunhos TO service_role;

ALTER TABLE public.agentes_ia_rascunhos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own AI agent drafts" ON public.agentes_ia_rascunhos;
CREATE POLICY "Users manage their own AI agent drafts"
ON public.agentes_ia_rascunhos
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_agentes_ia_rascunhos_updated_at ON public.agentes_ia_rascunhos;
CREATE TRIGGER update_agentes_ia_rascunhos_updated_at
BEFORE UPDATE ON public.agentes_ia_rascunhos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();