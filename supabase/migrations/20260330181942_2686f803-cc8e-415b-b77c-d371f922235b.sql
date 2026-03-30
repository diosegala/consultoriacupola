
CREATE TABLE public.projeto_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  conteudo text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view projeto_documentos"
  ON public.projeto_documentos FOR SELECT TO authenticated
  USING (
    is_authorized_user(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM projetos p
      WHERE p.id = projeto_documentos.projeto_id
        AND p.consultor_id = get_consultor_id_for_user(auth.uid())
    )
  );

CREATE POLICY "Authorized users can insert projeto_documentos"
  ON public.projeto_documentos FOR INSERT TO authenticated
  WITH CHECK (
    is_authorized_user(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM projetos p
      WHERE p.id = projeto_documentos.projeto_id
        AND p.consultor_id = get_consultor_id_for_user(auth.uid())
    )
  );

CREATE POLICY "Authorized users can delete projeto_documentos"
  ON public.projeto_documentos FOR DELETE TO authenticated
  USING (
    is_authorized_user(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM projetos p
      WHERE p.id = projeto_documentos.projeto_id
        AND p.consultor_id = get_consultor_id_for_user(auth.uid())
    )
  );
