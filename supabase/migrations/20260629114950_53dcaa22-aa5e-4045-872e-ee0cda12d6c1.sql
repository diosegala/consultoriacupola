
REVOKE EXECUTE ON FUNCTION public.notify_todo_atribuida() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_projeto_etapa() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_projeto_comentario() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_checklist_concluido() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_questionario_finalizado() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_id_for_consultor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_notificacoes_contratos_vencendo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_notificacoes_contratos_vencendo() TO service_role;
