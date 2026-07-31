-- 1. Tokens Google: restringir ao dono ou admin/diretor
DROP POLICY IF EXISTS "Consultor vê próprios tokens" ON public.consultor_google_tokens;
DROP POLICY IF EXISTS "Consultor insere próprios tokens" ON public.consultor_google_tokens;
DROP POLICY IF EXISTS "Consultor atualiza próprios tokens" ON public.consultor_google_tokens;
DROP POLICY IF EXISTS "Consultor deleta próprios tokens" ON public.consultor_google_tokens;

CREATE POLICY "Tokens Google: dono ou admin/diretor vê"
ON public.consultor_google_tokens FOR SELECT TO authenticated
USING (consultor_id = public.get_consultor_id_for_user(auth.uid()) OR public.is_admin_or_director(auth.uid()));

CREATE POLICY "Tokens Google: dono ou admin/diretor insere"
ON public.consultor_google_tokens FOR INSERT TO authenticated
WITH CHECK (consultor_id = public.get_consultor_id_for_user(auth.uid()) OR public.is_admin_or_director(auth.uid()));

CREATE POLICY "Tokens Google: dono ou admin/diretor atualiza"
ON public.consultor_google_tokens FOR UPDATE TO authenticated
USING (consultor_id = public.get_consultor_id_for_user(auth.uid()) OR public.is_admin_or_director(auth.uid()))
WITH CHECK (consultor_id = public.get_consultor_id_for_user(auth.uid()) OR public.is_admin_or_director(auth.uid()));

CREATE POLICY "Tokens Google: dono ou admin/diretor deleta"
ON public.consultor_google_tokens FOR DELETE TO authenticated
USING (consultor_id = public.get_consultor_id_for_user(auth.uid()) OR public.is_admin_or_director(auth.uid()));

-- 2. Revogar EXECUTE de anon em funções SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.auto_resolver_alertas_reuniao() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.auto_resolver_alertas_checklist() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.auto_resolver_alertas_atendimento() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.auto_resolver_alertas_interacao() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_director(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin_or_director(uuid) TO authenticated, service_role;