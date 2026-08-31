CREATE TABLE public.acessos_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  evento text NOT NULL DEFAULT 'login',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.acessos_log TO authenticated;
GRANT ALL ON public.acessos_log TO service_role;

ALTER TABLE public.acessos_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e diretores veem todos os acessos"
ON public.acessos_log FOR SELECT TO authenticated
USING (public.is_admin_or_director(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Usuario registra o proprio acesso"
ON public.acessos_log FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_acessos_log_created_at ON public.acessos_log (created_at DESC);
CREATE INDEX idx_acessos_log_user ON public.acessos_log (user_id, created_at DESC);