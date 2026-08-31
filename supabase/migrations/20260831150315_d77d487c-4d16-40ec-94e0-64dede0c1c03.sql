REVOKE EXECUTE ON FUNCTION public.chat_validar_reply() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.chat_evitar_direta_duplicada() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.chat_apos_mensagem() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.chat_direta_key(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_chat_participante(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_chat_participante(uuid, uuid) TO authenticated;