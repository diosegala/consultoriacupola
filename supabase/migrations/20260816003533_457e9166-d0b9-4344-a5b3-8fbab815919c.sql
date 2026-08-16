CREATE TABLE public.politicas_decisao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  parametros jsonb NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  atualizado_por uuid REFERENCES auth.users(id),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  versao integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.politicas_decisao TO authenticated;
GRANT INSERT, UPDATE ON public.politicas_decisao TO authenticated;
GRANT ALL ON public.politicas_decisao TO service_role;

ALTER TABLE public.politicas_decisao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "politicas_decisao_select" ON public.politicas_decisao
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "politicas_decisao_insert" ON public.politicas_decisao
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_director(auth.uid()));

CREATE POLICY "politicas_decisao_update" ON public.politicas_decisao
  FOR UPDATE TO authenticated USING (public.is_admin_or_director(auth.uid()))
  WITH CHECK (public.is_admin_or_director(auth.uid()));

CREATE UNIQUE INDEX politicas_decisao_tipo_ativo_idx ON public.politicas_decisao (tipo) WHERE ativo;

INSERT INTO public.politicas_decisao (tipo, parametros, ativo)
VALUES ('risco_churn', '{"score_critico": 6.0, "media_critica": 6.5, "queda_minima": 1.5, "min_reunioes": 2, "janela_dias": 180, "contrato_vence_em_dias": 90}'::jsonb, true);