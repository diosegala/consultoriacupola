
-- Marcadores de arquivamento
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS arquivado_em timestamptz,
  ADD COLUMN IF NOT EXISTS arquivado_por uuid;

CREATE INDEX IF NOT EXISTS idx_clientes_arquivado_em
  ON public.clientes (arquivado_em);

-- Restringe hard delete de cliente a admin (diretor não deleta mais fisicamente)
DROP POLICY IF EXISTS "clientes_delete" ON public.clientes;
CREATE POLICY "clientes_delete_admin_only" ON public.clientes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
