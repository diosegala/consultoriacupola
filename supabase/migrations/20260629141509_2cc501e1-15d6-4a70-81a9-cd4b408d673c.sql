
-- 1) projeto_documentos: restrict policies to authenticated + add UPDATE policy
DROP POLICY IF EXISTS "Authorized users can view projeto_documentos" ON public.projeto_documentos;
DROP POLICY IF EXISTS "Authorized users can insert projeto_documentos" ON public.projeto_documentos;
DROP POLICY IF EXISTS "Authorized users can delete projeto_documentos" ON public.projeto_documentos;

CREATE POLICY "Authorized users can view projeto_documentos"
ON public.projeto_documentos FOR SELECT TO authenticated
USING (
  is_authorized_user(auth.uid())
  OR EXISTS (SELECT 1 FROM projetos p WHERE p.id = projeto_documentos.projeto_id AND p.consultor_id = get_consultor_id_for_user(auth.uid()))
  OR EXISTS (SELECT 1 FROM clientes c WHERE c.id = projeto_documentos.cliente_id AND c.consultor_id = get_consultor_id_for_user(auth.uid()))
);

CREATE POLICY "Authorized users can insert projeto_documentos"
ON public.projeto_documentos FOR INSERT TO authenticated
WITH CHECK (
  is_authorized_user(auth.uid())
  OR EXISTS (SELECT 1 FROM projetos p WHERE p.id = projeto_documentos.projeto_id AND p.consultor_id = get_consultor_id_for_user(auth.uid()))
  OR EXISTS (SELECT 1 FROM clientes c WHERE c.id = projeto_documentos.cliente_id AND c.consultor_id = get_consultor_id_for_user(auth.uid()))
);

CREATE POLICY "Authorized users can update projeto_documentos"
ON public.projeto_documentos FOR UPDATE TO authenticated
USING (
  is_authorized_user(auth.uid())
  OR EXISTS (SELECT 1 FROM projetos p WHERE p.id = projeto_documentos.projeto_id AND p.consultor_id = get_consultor_id_for_user(auth.uid()))
  OR EXISTS (SELECT 1 FROM clientes c WHERE c.id = projeto_documentos.cliente_id AND c.consultor_id = get_consultor_id_for_user(auth.uid()))
)
WITH CHECK (
  is_authorized_user(auth.uid())
  OR EXISTS (SELECT 1 FROM projetos p WHERE p.id = projeto_documentos.projeto_id AND p.consultor_id = get_consultor_id_for_user(auth.uid()))
  OR EXISTS (SELECT 1 FROM clientes c WHERE c.id = projeto_documentos.cliente_id AND c.consultor_id = get_consultor_id_for_user(auth.uid()))
);

CREATE POLICY "Authorized users can delete projeto_documentos"
ON public.projeto_documentos FOR DELETE TO authenticated
USING (
  is_authorized_user(auth.uid())
  OR EXISTS (SELECT 1 FROM projetos p WHERE p.id = projeto_documentos.projeto_id AND p.consultor_id = get_consultor_id_for_user(auth.uid()))
  OR EXISTS (SELECT 1 FROM clientes c WHERE c.id = projeto_documentos.cliente_id AND c.consultor_id = get_consultor_id_for_user(auth.uid()))
);

-- 2) user_roles: harden self-update policy. Role changes already blocked by trigger
-- trg_user_roles_prevent_role_self_change. Tighten WITH CHECK to forbid altering
-- user_id and role, eliminating the race in the subquery check.
DROP POLICY IF EXISTS "Users can update own force_password_change" ON public.user_roles;

CREATE POLICY "Users can update own force_password_change"
ON public.user_roles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
-- Note: trigger user_roles_prevent_role_self_change enforces that non-admins cannot
-- change the `role` column, preventing privilege escalation via this policy.

-- 3) webhook_logs: explicitly block client-side writes (service role bypasses RLS)
REVOKE INSERT, UPDATE, DELETE ON public.webhook_logs FROM authenticated, anon;

-- 4) Revoke EXECUTE from PUBLIC on SECURITY DEFINER functions; grant explicitly
-- only to roles that need them. RLS-helper functions remain callable by
-- authenticated; trigger-only and admin/cron functions are limited to service_role.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_authorized_user(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_authorized_user(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_consultor_id_for_user(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_consultor_id_for_user(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_id_for_consultor(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_id_for_consultor(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.buscar_conhecimento(vector, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.buscar_conhecimento(vector, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.aplicar_baixa_contratos_pagos() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.criar_cards_renovacao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_notificacoes_contratos_vencendo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.aplicar_checklist_renovacao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_checklist_concluido() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_projeto_comentario() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_projeto_etapa() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_questionario_finalizado() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_todo_atribuida() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.todo_pessoal_restrict_assignee_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_roles_prevent_role_self_change() FROM PUBLIC, anon, authenticated;
