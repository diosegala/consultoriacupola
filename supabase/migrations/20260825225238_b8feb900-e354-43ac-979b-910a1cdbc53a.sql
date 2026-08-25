CREATE TABLE public.insight_correcoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insight_id UUID REFERENCES public.insights_agregados(id) ON DELETE SET NULL,
  tipo_insight TEXT NOT NULL,
  secao TEXT NOT NULL,
  tema TEXT NOT NULL,
  operacao_ia TEXT,
  operacao_correta TEXT NOT NULL,
  observacao TEXT,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insight_correcoes TO authenticated;
GRANT ALL ON public.insight_correcoes TO service_role;

ALTER TABLE public.insight_correcoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insight_correcoes_select" ON public.insight_correcoes
  FOR SELECT TO authenticated USING (public.is_admin_or_director(auth.uid()));

CREATE POLICY "insight_correcoes_insert" ON public.insight_correcoes
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_director(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "insight_correcoes_delete" ON public.insight_correcoes
  FOR DELETE TO authenticated USING (public.is_admin_or_director(auth.uid()));

CREATE INDEX idx_insight_correcoes_tipo ON public.insight_correcoes (tipo_insight, created_at DESC);