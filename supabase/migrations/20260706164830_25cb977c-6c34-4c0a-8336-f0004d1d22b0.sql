
CREATE TABLE public.transcricoes_sumarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  label text NOT NULL,
  papel text,
  data_entrevista date,
  sumario text NOT NULL,
  num_chars_original integer,
  hash_conteudo text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_transcricoes_sumarios_cliente ON public.transcricoes_sumarios(cliente_id);
CREATE UNIQUE INDEX idx_transcricoes_sumarios_cliente_hash
  ON public.transcricoes_sumarios(cliente_id, hash_conteudo)
  WHERE hash_conteudo IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transcricoes_sumarios TO authenticated;
GRANT ALL ON public.transcricoes_sumarios TO service_role;

ALTER TABLE public.transcricoes_sumarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa tudo em transcricoes_sumarios"
  ON public.transcricoes_sumarios FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Consultor le sumarios dos seus clientes"
  ON public.transcricoes_sumarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = transcricoes_sumarios.cliente_id
        AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
    )
  );

CREATE POLICY "Consultor insere sumarios dos seus clientes"
  ON public.transcricoes_sumarios FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = transcricoes_sumarios.cliente_id
        AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
    )
  );

CREATE POLICY "Consultor atualiza sumarios dos seus clientes"
  ON public.transcricoes_sumarios FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = transcricoes_sumarios.cliente_id
        AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
    )
  );

CREATE POLICY "Consultor deleta sumarios dos seus clientes"
  ON public.transcricoes_sumarios FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = transcricoes_sumarios.cliente_id
        AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
    )
  );
