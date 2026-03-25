
-- Tabela de reuniões dos consultores
CREATE TABLE public.reunioes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id uuid NOT NULL REFERENCES public.consultores(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  data_reuniao date NOT NULL,
  duracao_minutos integer,
  transcricao text,
  resumo_ia text,
  score_ia numeric,
  analise_ia jsonb,
  google_meet_link text,
  status_analise text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.reunioes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view reunioes" ON public.reunioes FOR SELECT TO authenticated USING (is_authorized_user(auth.uid()));
CREATE POLICY "Authorized users can insert reunioes" ON public.reunioes FOR INSERT TO authenticated WITH CHECK (is_authorized_user(auth.uid()));
CREATE POLICY "Authorized users can update reunioes" ON public.reunioes FOR UPDATE TO authenticated USING (is_authorized_user(auth.uid()));
CREATE POLICY "Authorized users can delete reunioes" ON public.reunioes FOR DELETE TO authenticated USING (is_authorized_user(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_reunioes_updated_at
  BEFORE UPDATE ON public.reunioes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
