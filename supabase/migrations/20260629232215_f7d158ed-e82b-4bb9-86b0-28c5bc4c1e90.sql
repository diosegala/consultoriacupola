
-- 1) Tighten user_roles self-update policy: only allow updating force_password_change
DROP POLICY IF EXISTS "Users can update own force_password_change" ON public.user_roles;
CREATE POLICY "Users can update own force_password_change"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND role = (SELECT ur.role FROM public.user_roles ur WHERE ur.id = user_roles.id)
  );

-- 2) Auditoria insert: require user_id = auth.uid(), no NULL bypass
DROP POLICY IF EXISTS "Usuarios autenticados podem inserir auditoria" ON public.auditoria_status_cliente;
CREATE POLICY "Usuarios autenticados podem inserir auditoria"
  ON public.auditoria_status_cliente
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
