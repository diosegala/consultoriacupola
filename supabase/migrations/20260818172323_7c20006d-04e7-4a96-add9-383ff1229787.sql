DROP POLICY IF EXISTS docs_select ON public.projeto_documentos;
DROP POLICY IF EXISTS docs_insert ON public.projeto_documentos;
DROP POLICY IF EXISTS docs_update ON public.projeto_documentos;
DROP POLICY IF EXISTS docs_delete ON public.projeto_documentos;

CREATE POLICY docs_select ON public.projeto_documentos FOR SELECT TO authenticated
USING (
  public.is_admin_or_director(auth.uid())
  OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_documentos.projeto_id AND p.consultor_id = public.get_consultor_id_for_user(auth.uid()))
  OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = projeto_documentos.cliente_id AND c.consultor_id = public.get_consultor_id_for_user(auth.uid()))
);

CREATE POLICY docs_insert ON public.projeto_documentos FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_or_director(auth.uid())
  OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_documentos.projeto_id AND p.consultor_id = public.get_consultor_id_for_user(auth.uid()))
  OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = projeto_documentos.cliente_id AND c.consultor_id = public.get_consultor_id_for_user(auth.uid()))
);

CREATE POLICY docs_update ON public.projeto_documentos FOR UPDATE TO authenticated
USING (
  public.is_admin_or_director(auth.uid())
  OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_documentos.projeto_id AND p.consultor_id = public.get_consultor_id_for_user(auth.uid()))
  OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = projeto_documentos.cliente_id AND c.consultor_id = public.get_consultor_id_for_user(auth.uid()))
);

CREATE POLICY docs_delete ON public.projeto_documentos FOR DELETE TO authenticated
USING (
  public.is_admin_or_director(auth.uid())
  OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_documentos.projeto_id AND p.consultor_id = public.get_consultor_id_for_user(auth.uid()))
  OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = projeto_documentos.cliente_id AND c.consultor_id = public.get_consultor_id_for_user(auth.uid()))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_documentos TO authenticated;
GRANT ALL ON public.projeto_documentos TO service_role;