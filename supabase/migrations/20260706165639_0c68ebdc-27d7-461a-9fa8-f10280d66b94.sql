
CREATE TABLE public.compromissos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  reuniao_id uuid REFERENCES public.reunioes(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  responsavel text NOT NULL CHECK (responsavel IN ('cliente', 'consultor')),
  prazo date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido', 'cancelado', 'adiado')),
  origem text NOT NULL DEFAULT 'ia' CHECK (origem IN ('ia', 'manual')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_compromissos_cliente ON public.compromissos(cliente_id);
CREATE INDEX idx_compromissos_reuniao ON public.compromissos(reuniao_id);
CREATE INDEX idx_compromissos_status ON public.compromissos(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compromissos TO authenticated;
GRANT ALL ON public.compromissos TO service_role;

ALTER TABLE public.compromissos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa tudo em compromissos"
  ON public.compromissos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Consultor le compromissos dos seus clientes"
  ON public.compromissos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = compromissos.cliente_id
        AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
    )
  );

CREATE POLICY "Consultor insere compromissos dos seus clientes"
  ON public.compromissos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = compromissos.cliente_id
        AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
    )
  );

CREATE POLICY "Consultor atualiza compromissos dos seus clientes"
  ON public.compromissos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = compromissos.cliente_id
        AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
    )
  );

CREATE POLICY "Consultor deleta compromissos dos seus clientes"
  ON public.compromissos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = compromissos.cliente_id
        AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
    )
  );

CREATE TRIGGER trg_compromissos_updated_at
  BEFORE UPDATE ON public.compromissos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
