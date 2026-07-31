DROP POLICY IF EXISTS "Users can view own link" ON public.consultor_user;
DROP POLICY IF EXISTS "consultor_user_select" ON public.consultor_user;
CREATE POLICY "consultor_user_select" ON public.consultor_user FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','director')
  )
);

DROP POLICY IF EXISTS "reunioes_select" ON public.reunioes;
DROP POLICY IF EXISTS "reunioes_select_by_role" ON public.reunioes;
CREATE POLICY "reunioes_select_by_role" ON public.reunioes FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','director')
  )
  OR consultor_id IN (
    SELECT cu.consultor_id FROM public.consultor_user cu WHERE cu.user_id = auth.uid()
  )
);