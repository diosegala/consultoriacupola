DROP POLICY IF EXISTS "Authorized users can view projetos" ON public.projetos;

CREATE POLICY "projetos_select" ON public.projetos
FOR SELECT TO authenticated
USING (
  public.is_admin_or_director(auth.uid())
  OR consultor_id = public.get_consultor_id_for_user(auth.uid())
);