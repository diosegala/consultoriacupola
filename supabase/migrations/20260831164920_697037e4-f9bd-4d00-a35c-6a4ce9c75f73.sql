CREATE OR REPLACE FUNCTION public.chat_diretorio_usuarios()
RETURNS TABLE(user_id uuid, nome text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cu.user_id, c.nome::text
  FROM public.consultor_user cu
  JOIN public.consultores c ON c.id = cu.consultor_id
  WHERE c.ativo = true
  ORDER BY c.nome
$$;

REVOKE EXECUTE ON FUNCTION public.chat_diretorio_usuarios() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.chat_diretorio_usuarios() TO authenticated;