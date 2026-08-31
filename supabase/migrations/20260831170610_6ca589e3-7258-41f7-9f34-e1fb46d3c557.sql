DROP POLICY IF EXISTS conversas_select_participante ON public.chat_conversas;

CREATE POLICY conversas_select_participante ON public.chat_conversas
FOR SELECT TO authenticated
USING (is_chat_participante(id, auth.uid()) OR criado_por = auth.uid());

CREATE POLICY conversas_delete_criador ON public.chat_conversas
FOR DELETE TO authenticated
USING (criado_por = auth.uid());