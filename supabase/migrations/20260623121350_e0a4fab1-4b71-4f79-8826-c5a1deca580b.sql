
-- Fix 1: Prevent self role escalation. Restrict users to only updating force_password_change on their row.
DROP POLICY IF EXISTS "Users can update own force_password_change" ON public.user_roles;

CREATE POLICY "Users can update own force_password_change"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND role = (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1)
);

-- Admins keep full update via existing patterns; add explicit admin update policy for completeness.
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Defense in depth: trigger blocks any non-admin from changing the role column.
CREATE OR REPLACE FUNCTION public.user_roles_prevent_role_self_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_prevent_role_self_change ON public.user_roles;
CREATE TRIGGER trg_user_roles_prevent_role_self_change
BEFORE UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.user_roles_prevent_role_self_change();

-- Fix 2 & 3: Restrict EXECUTE on SECURITY DEFINER helper functions so only authenticated role can call them via API.
-- These functions are intended only for use within RLS/triggers, so revoke from anon/public.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_authorized_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_consultor_id_for_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aplicar_baixa_contratos_pagos() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.todo_pessoal_restrict_assignee_update() FROM PUBLIC, anon, authenticated;
