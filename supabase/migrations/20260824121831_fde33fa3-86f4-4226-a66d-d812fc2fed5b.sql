CREATE TABLE public.agente_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid REFERENCES public.projeto_documentos(id) ON DELETE CASCADE,
  tipo_agente text NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  nota integer NOT NULL,
  marcadores text[] NOT NULL DEFAULT '{}',
  comentario text,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  consolidado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agente_feedbacks TO authenticated;
GRANT ALL ON public.agente_feedbacks TO service_role;
ALTER TABLE public.agente_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedbacks_select" ON public.agente_feedbacks FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_director(auth.uid()));
CREATE POLICY "feedbacks_insert" ON public.agente_feedbacks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_authorized_user(auth.uid()) AND nota BETWEEN 1 AND 5);
CREATE POLICY "feedbacks_update" ON public.agente_feedbacks FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_director(auth.uid()))
  WITH CHECK (nota BETWEEN 1 AND 5);
CREATE POLICY "feedbacks_delete" ON public.agente_feedbacks FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_agente_feedbacks_tipo ON public.agente_feedbacks(tipo_agente, created_at DESC);

CREATE TABLE public.agente_diretrizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_agente text NOT NULL,
  conteudo text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  versao integer NOT NULL DEFAULT 1,
  origem text NOT NULL DEFAULT 'ia',
  feedbacks_considerados integer NOT NULL DEFAULT 0,
  aprovado_por uuid,
  aprovado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agente_diretrizes TO authenticated;
GRANT ALL ON public.agente_diretrizes TO service_role;
ALTER TABLE public.agente_diretrizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diretrizes_select" ON public.agente_diretrizes FOR SELECT TO authenticated
  USING (public.is_authorized_user(auth.uid()));
CREATE POLICY "diretrizes_insert" ON public.agente_diretrizes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "diretrizes_update" ON public.agente_diretrizes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "diretrizes_delete" ON public.agente_diretrizes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_agente_diretrizes_tipo_status ON public.agente_diretrizes(tipo_agente, status);

ALTER TABLE public.projeto_documentos
  ADD COLUMN aprovado_como_exemplo boolean NOT NULL DEFAULT false,
  ADD COLUMN conteudo_revisado text,
  ADD COLUMN truncado boolean NOT NULL DEFAULT false;