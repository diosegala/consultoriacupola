
-- 1. Tipo do projeto
ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'normal'
    CHECK (tipo IN ('normal','renovacao'));

CREATE INDEX IF NOT EXISTS idx_projetos_tipo ON public.projetos(tipo);
CREATE INDEX IF NOT EXISTS idx_projetos_contrato ON public.projetos(contrato_id);

-- 2. Novas etapas
INSERT INTO public.projetos_etapas (nome, ordem, ativo) VALUES
  ('Ciclo de Renovação', 8, true),
  ('Negociação de Renovação', 9, true),
  ('Renovação Fechada', 10, true)
ON CONFLICT DO NOTHING;

-- 3. Função que cria card de renovação para contratos a ≤120 dias do fim
CREATE OR REPLACE FUNCTION public.criar_cards_renovacao()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etapa_ciclo uuid;
  v_contrato RECORD;
  v_novo_projeto_id uuid;
  v_count integer := 0;
BEGIN
  SELECT id INTO v_etapa_ciclo FROM public.projetos_etapas WHERE nome = 'Ciclo de Renovação' LIMIT 1;
  IF v_etapa_ciclo IS NULL THEN RETURN 0; END IF;

  FOR v_contrato IN
    SELECT c.id AS contrato_id, c.cliente_id, c.data_fim, cl.consultor_id
    FROM public.contratos c
    JOIN public.clientes cl ON cl.id = c.cliente_id
    WHERE c.ativo = true
      AND c.encerrado_em IS NULL
      AND cl.consultor_id IS NOT NULL
      AND c.data_fim - CURRENT_DATE <= 120
      AND c.data_fim - CURRENT_DATE >= 0
      AND NOT EXISTS (
        SELECT 1 FROM public.projetos p
        WHERE p.contrato_id = c.id AND p.tipo = 'renovacao'
      )
  LOOP
    INSERT INTO public.projetos (cliente_id, contrato_id, consultor_id, etapa_id, ordem_na_etapa, tipo, due_date)
    VALUES (v_contrato.cliente_id, v_contrato.contrato_id, v_contrato.consultor_id, v_etapa_ciclo, 0, 'renovacao', v_contrato.data_fim)
    RETURNING id INTO v_novo_projeto_id;

    -- Checklist padrão da etapa "Ciclo de Renovação"
    INSERT INTO public.projeto_checklist (projeto_id, titulo, ordem) VALUES
      (v_novo_projeto_id, 'Revisar resultados e OKRs do ciclo atual', 0),
      (v_novo_projeto_id, 'Montar resumo de entregas do contrato', 1),
      (v_novo_projeto_id, 'Agendar reunião de balanço com o cliente', 2),
      (v_novo_projeto_id, 'Alinhar internamente possíveis ajustes de escopo', 3);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_cards_renovacao() FROM PUBLIC, anon, authenticated;

-- 4. Função que aplica checklist padrão ao mover card de renovação para nova etapa
CREATE OR REPLACE FUNCTION public.aplicar_checklist_renovacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etapa_nome text;
  v_max_ordem integer;
BEGIN
  IF NEW.tipo <> 'renovacao' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.etapa_id = OLD.etapa_id THEN RETURN NEW; END IF;

  SELECT nome INTO v_etapa_nome FROM public.projetos_etapas WHERE id = NEW.etapa_id;

  SELECT COALESCE(MAX(ordem), -1) INTO v_max_ordem
  FROM public.projeto_checklist WHERE projeto_id = NEW.id;

  IF v_etapa_nome = 'Negociação de Renovação' THEN
    IF NOT EXISTS (SELECT 1 FROM public.projeto_checklist WHERE projeto_id = NEW.id AND titulo = 'Enviar proposta de renovação') THEN
      INSERT INTO public.projeto_checklist (projeto_id, titulo, ordem) VALUES
        (NEW.id, 'Enviar proposta de renovação', v_max_ordem + 1),
        (NEW.id, 'Alinhar escopo e entregas do novo ciclo', v_max_ordem + 2),
        (NEW.id, 'Definir valor, prazo e parcelamento', v_max_ordem + 3),
        (NEW.id, 'Confirmar aceite do cliente', v_max_ordem + 4);
    END IF;
  ELSIF v_etapa_nome = 'Renovação Fechada' THEN
    IF NOT EXISTS (SELECT 1 FROM public.projeto_checklist WHERE projeto_id = NEW.id AND titulo = 'Assinar novo contrato') THEN
      INSERT INTO public.projeto_checklist (projeto_id, titulo, ordem) VALUES
        (NEW.id, 'Assinar novo contrato', v_max_ordem + 1),
        (NEW.id, 'Lançar renovação no sistema', v_max_ordem + 2),
        (NEW.id, 'Arquivar card e iniciar novo ciclo', v_max_ordem + 3);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_checklist_renovacao_ins ON public.projetos;
CREATE TRIGGER trg_aplicar_checklist_renovacao_ins
AFTER INSERT ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.aplicar_checklist_renovacao();

DROP TRIGGER IF EXISTS trg_aplicar_checklist_renovacao_upd ON public.projetos;
CREATE TRIGGER trg_aplicar_checklist_renovacao_upd
AFTER UPDATE OF etapa_id ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.aplicar_checklist_renovacao();
