CREATE OR REPLACE FUNCTION public.is_authorized_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'director'::app_role, 'consultor'::app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.pode_usar_chat(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

REVOKE EXECUTE ON FUNCTION public.pode_usar_chat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_usar_chat(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS conversas_insert_autorizado ON public.chat_conversas;
CREATE POLICY conversas_insert_autorizado ON public.chat_conversas
  FOR INSERT TO authenticated
  WITH CHECK (public.pode_usar_chat(auth.uid()) AND criado_por = auth.uid());

DROP POLICY IF EXISTS participantes_insert ON public.chat_participantes;
CREATE POLICY participantes_insert ON public.chat_participantes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.pode_usar_chat(auth.uid())
    AND (
      EXISTS (SELECT 1 FROM public.chat_conversas c WHERE c.id = chat_participantes.conversa_id AND c.criado_por = auth.uid())
      OR public.is_chat_participante(conversa_id, auth.uid())
    )
  );