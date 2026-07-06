
CREATE TABLE public.reunioes_gestao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diretor_id uuid NOT NULL REFERENCES public.consultores(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('individual', 'equipe')),
  participantes text[] NOT NULL DEFAULT '{}',
  data_reuniao date NOT NULL,
  transcricao text,
  resumo_ia text,
  analise_ia jsonb,
  status_analise text NOT NULL DEFAULT 'pendente',
  google_file_id text,
  nome_arquivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reunioes_gestao_diretor ON public.reunioes_gestao (diretor_id, data_reuniao DESC);
CREATE INDEX idx_reunioes_gestao_status ON public.reunioes_gestao (status_analise);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reunioes_gestao TO authenticated;
GRANT ALL ON public.reunioes_gestao TO service_role;

ALTER TABLE public.reunioes_gestao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem todas reunioes gestao"
  ON public.reunioes_gestao FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "Diretor ve suas reunioes gestao"
  ON public.reunioes_gestao FOR SELECT TO authenticated
  USING (diretor_id = public.get_consultor_id_for_user(auth.uid()));

CREATE POLICY "Admins gerenciam reunioes gestao"
  ON public.reunioes_gestao FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "Diretor gerencia suas reunioes gestao"
  ON public.reunioes_gestao FOR ALL TO authenticated
  USING (diretor_id = public.get_consultor_id_for_user(auth.uid()))
  WITH CHECK (diretor_id = public.get_consultor_id_for_user(auth.uid()));

CREATE TRIGGER reunioes_gestao_updated_at
  BEFORE UPDATE ON public.reunioes_gestao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
