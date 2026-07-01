
-- 1. Metadata column
ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notificacoes_user_lida_tipo
  ON public.notificacoes (user_id, lida, tipo, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificacoes_entidade
  ON public.notificacoes (entidade_tipo, entidade_id) WHERE lida = false;

-- 2. Auto-resolve: nova reunião => marca alertas "sem_contato" / "reuniao_atrasada" do cliente como lidos
CREATE OR REPLACE FUNCTION public.auto_resolver_alertas_reuniao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notificacoes n
     SET lida = true, lida_em = now()
   FROM public.consultor_user cu
   WHERE cu.user_id = n.user_id
     AND cu.consultor_id = NEW.consultor_id
     AND n.lida = false
     AND n.entidade_tipo = 'cliente'
     AND n.entidade_id = NEW.cliente_id
     AND n.tipo IN ('sem_contato', 'reuniao_atrasada');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_resolver_alertas_reuniao ON public.reunioes;
CREATE TRIGGER trg_auto_resolver_alertas_reuniao
AFTER INSERT ON public.reunioes
FOR EACH ROW EXECUTE FUNCTION public.auto_resolver_alertas_reuniao();

-- 3. Auto-resolve: checklist item concluído => resolve "checklist_parado" do projeto
CREATE OR REPLACE FUNCTION public.auto_resolver_alertas_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consultor_id uuid;
  v_user uuid;
BEGIN
  IF NEW.concluido = true AND COALESCE(OLD.concluido, false) = false THEN
    SELECT consultor_id INTO v_consultor_id FROM public.projetos WHERE id = NEW.projeto_id;
    v_user := public.get_user_id_for_consultor(v_consultor_id);
    IF v_user IS NOT NULL THEN
      UPDATE public.notificacoes
         SET lida = true, lida_em = now()
       WHERE user_id = v_user
         AND lida = false
         AND tipo = 'checklist_parado'
         AND entidade_tipo = 'projeto'
         AND entidade_id = NEW.projeto_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_resolver_alertas_checklist ON public.projeto_checklist;
CREATE TRIGGER trg_auto_resolver_alertas_checklist
AFTER UPDATE ON public.projeto_checklist
FOR EACH ROW EXECUTE FUNCTION public.auto_resolver_alertas_checklist();

-- 4. Auto-resolve: atendimento atualizado com nova próxima_reuniao futura => resolve reunião atrasada
CREATE OR REPLACE FUNCTION public.auto_resolver_alertas_atendimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consultor_id uuid;
  v_user uuid;
BEGIN
  IF NEW.proxima_reuniao IS NOT NULL
     AND NEW.proxima_reuniao >= CURRENT_DATE
     AND NEW.proxima_reuniao IS DISTINCT FROM OLD.proxima_reuniao THEN
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_resolver_alertas_atendimento ON public.atendimentos;
CREATE TRIGGER trg_auto_resolver_alertas_atendimento
AFTER UPDATE ON public.atendimentos
FOR EACH ROW EXECUTE FUNCTION public.auto_resolver_alertas_atendimento();
