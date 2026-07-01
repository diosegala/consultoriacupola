
CREATE TABLE public.insights_agregados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  periodo_analisado text,
  filtros jsonb DEFAULT '{}'::jsonb,
  conteudo jsonb NOT NULL,
  gerado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insights_agregados TO authenticated;
GRANT ALL ON public.insights_agregados TO service_role;
ALTER TABLE public.insights_agregados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins e diretores gerenciam insights" ON public.insights_agregados
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
CREATE INDEX idx_insights_tipo_data ON public.insights_agregados(tipo, created_at DESC);

CREATE TABLE public.oportunidades_produto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text NOT NULL,
  evidencia text,
  potencial_demanda text,
  status text NOT NULL DEFAULT 'aberta',
  notas text,
  criado_por uuid REFERENCES auth.users(id),
  origem_insight_id uuid REFERENCES public.insights_agregados(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oportunidades_produto TO authenticated;
GRANT ALL ON public.oportunidades_produto TO service_role;
ALTER TABLE public.oportunidades_produto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins e diretores gerenciam oportunidades" ON public.oportunidades_produto
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
CREATE TRIGGER update_oportunidades_produto_updated_at
  BEFORE UPDATE ON public.oportunidades_produto
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
