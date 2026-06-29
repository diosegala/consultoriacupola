
ALTER TABLE public.projeto_documentos
  ALTER COLUMN projeto_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS gdoc_url text;

ALTER TABLE public.projeto_documentos
  DROP CONSTRAINT IF EXISTS check_documento_vinculo;
ALTER TABLE public.projeto_documentos
  ADD CONSTRAINT check_documento_vinculo
  CHECK (projeto_id IS NOT NULL OR cliente_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS projeto_documentos_cliente_id_idx
  ON public.projeto_documentos(cliente_id);

-- Atualizar policies para também aceitar cliente_id direto
DROP POLICY IF EXISTS "Authorized users can view projeto_documentos" ON public.projeto_documentos;
DROP POLICY IF EXISTS "Authorized users can insert projeto_documentos" ON public.projeto_documentos;
DROP POLICY IF EXISTS "Authorized users can delete projeto_documentos" ON public.projeto_documentos;

CREATE POLICY "Authorized users can view projeto_documentos"
ON public.projeto_documentos
FOR SELECT
USING (
  public.is_authorized_user(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = projeto_documentos.projeto_id
      AND p.consultor_id = public.get_consultor_id_for_user(auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = projeto_documentos.cliente_id
      AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
  )
);

CREATE POLICY "Authorized users can insert projeto_documentos"
ON public.projeto_documentos
FOR INSERT
WITH CHECK (
  public.is_authorized_user(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = projeto_documentos.projeto_id
      AND p.consultor_id = public.get_consultor_id_for_user(auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = projeto_documentos.cliente_id
      AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
  )
);

CREATE POLICY "Authorized users can delete projeto_documentos"
ON public.projeto_documentos
FOR DELETE
USING (
  public.is_authorized_user(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = projeto_documentos.projeto_id
      AND p.consultor_id = public.get_consultor_id_for_user(auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = projeto_documentos.cliente_id
      AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
  )
);
