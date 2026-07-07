
CREATE TYPE public.canal_interacao AS ENUM ('whatsapp', 'ligacao', 'email', 'reuniao_informal', 'outro');

CREATE TABLE public.interacoes_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  consultor_id uuid REFERENCES public.consultores(id) ON DELETE SET NULL,
  canal public.canal_interacao NOT NULL,
  data_interacao date NOT NULL DEFAULT CURRENT_DATE,
  resumo text NOT NULL,
  conteudo text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_interacoes_cliente_cliente ON public.interacoes_cliente(cliente_id, data_interacao DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interacoes_cliente TO authenticated;
GRANT ALL ON public.interacoes_cliente TO service_role;

ALTER TABLE public.interacoes_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/directors gerenciam todas interacoes"
  ON public.interacoes_cliente FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "Consultores veem interacoes de seus clientes"
  ON public.interacoes_cliente FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = interacoes_cliente.cliente_id
        AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
    )
  );

CREATE POLICY "Consultores registram interacoes de seus clientes"
  ON public.interacoes_cliente FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = interacoes_cliente.cliente_id
        AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
    )
  );

CREATE POLICY "Consultores editam suas interacoes"
  ON public.interacoes_cliente FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Consultores excluem suas interacoes"
  ON public.interacoes_cliente FOR DELETE
  USING (created_by = auth.uid());

CREATE TRIGGER trg_interacoes_cliente_updated_at
  BEFORE UPDATE ON public.interacoes_cliente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ao registrar uma interação, resolve alertas "sem_contato" e "reuniao_atrasada"
-- do consultor responsável e atualiza ultima_reuniao do atendimento se a interação
-- for mais recente (para o cron não refazer o alerta).
CREATE OR REPLACE FUNCTION public.auto_resolver_alertas_interacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_consultor_id uuid;
  v_user uuid;
BEGIN
  SELECT consultor_id INTO v_consultor_id FROM public.clientes WHERE id = NEW.cliente_id;
  v_user := public.get_user_id_for_consultor(v_consultor_id);

  IF v_user IS NOT NULL THEN
    UPDATE public.notificacoes
       SET lida = true, lida_em = now()
     WHERE user_id = v_user
       AND lida = false
       AND entidade_tipo = 'cliente'
       AND entidade_id = NEW.cliente_id
       AND tipo IN ('sem_contato', 'reuniao_atrasada');
  END IF;

  UPDATE public.atendimentos
     SET ultima_reuniao = NEW.data_interacao
   WHERE cliente_id = NEW.cliente_id
     AND (ultima_reuniao IS NULL OR ultima_reuniao < NEW.data_interacao);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_interacoes_cliente_resolver_alertas
  AFTER INSERT ON public.interacoes_cliente
  FOR EACH ROW EXECUTE FUNCTION public.auto_resolver_alertas_interacao();
