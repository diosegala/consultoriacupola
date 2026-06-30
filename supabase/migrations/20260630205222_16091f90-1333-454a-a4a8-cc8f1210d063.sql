
CREATE TABLE public.interacoes_tempo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  consultor_id uuid REFERENCES public.consultores(id) ON DELETE SET NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  tipo text NOT NULL,
  inicio_preparacao timestamptz NOT NULL,
  fim_preparacao timestamptz,
  duracao_preparacao_segundos integer,
  duracao_geracao_ia_segundos integer,
  tempo_total_decorrido_segundos integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_interacoes_tempo_consultor ON public.interacoes_tempo(consultor_id, created_at DESC);
CREATE INDEX idx_interacoes_tempo_cliente ON public.interacoes_tempo(cliente_id, created_at DESC);
CREATE INDEX idx_interacoes_tempo_tipo ON public.interacoes_tempo(tipo);

GRANT SELECT, INSERT, UPDATE ON public.interacoes_tempo TO authenticated;
GRANT ALL ON public.interacoes_tempo TO service_role;

ALTER TABLE public.interacoes_tempo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários inserem seus próprios registros de tempo"
ON public.interacoes_tempo FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários leem seus próprios registros de tempo"
ON public.interacoes_tempo FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins e diretores leem todos os registros de tempo"
ON public.interacoes_tempo FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "Usuários atualizam seus próprios registros de tempo"
ON public.interacoes_tempo FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);
