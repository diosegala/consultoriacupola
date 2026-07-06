
CREATE TABLE public.parse_erros_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  consultor_id UUID REFERENCES public.consultores(id) ON DELETE SET NULL,
  nome_arquivo TEXT,
  tipo TEXT,
  origem TEXT,
  tamanho_bytes BIGINT,
  erro TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_parse_erros_log_created_at ON public.parse_erros_log (created_at DESC);
CREATE INDEX idx_parse_erros_log_consultor ON public.parse_erros_log (consultor_id);

GRANT SELECT ON public.parse_erros_log TO authenticated;
GRANT ALL ON public.parse_erros_log TO service_role;

ALTER TABLE public.parse_erros_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos os erros de parse"
  ON public.parse_erros_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Consultor ve seus proprios erros de parse"
  ON public.parse_erros_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
