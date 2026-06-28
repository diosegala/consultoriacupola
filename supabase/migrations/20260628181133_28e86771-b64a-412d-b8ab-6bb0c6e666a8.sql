CREATE TABLE public.auditoria_status_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  origem text NOT NULL CHECK (origem IN ('mover_projeto','encerrar_contrato','renovar_contrato')),
  status_anterior text,
  status_novo text,
  etapa_anterior_id uuid,
  etapa_nova_id uuid,
  user_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.auditoria_status_cliente TO authenticated;
GRANT ALL ON public.auditoria_status_cliente TO service_role;

ALTER TABLE public.auditoria_status_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e diretores podem ver auditoria"
  ON public.auditoria_status_cliente FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE POLICY "Usuarios autenticados podem inserir auditoria"
  ON public.auditoria_status_cliente FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE INDEX idx_auditoria_status_cliente_cliente ON public.auditoria_status_cliente(cliente_id, created_at DESC);
CREATE INDEX idx_auditoria_status_cliente_created ON public.auditoria_status_cliente(created_at DESC);