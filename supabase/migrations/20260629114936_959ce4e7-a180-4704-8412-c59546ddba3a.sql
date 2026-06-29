
-- 1) Table
CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  link text,
  entidade_tipo text,
  entidade_id uuid,
  lida boolean NOT NULL DEFAULT false,
  lida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notificacoes_user_unread ON public.notificacoes(user_id, lida, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notificacoes
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications" ON public.notificacoes
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own notifications" ON public.notificacoes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Inserts come from SECURITY DEFINER triggers / service role only; no INSERT policy for authenticated.

-- Realtime
ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;

-- 2) Helper to fetch user_id of the consultor that owns a cliente
CREATE OR REPLACE FUNCTION public.get_user_id_for_consultor(_consultor_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM public.consultor_user WHERE consultor_id = _consultor_id LIMIT 1
$$;

-- 3) Trigger: tarefa atribuída
CREATE OR REPLACE FUNCTION public.notify_todo_atribuida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_by IS NOT NULL AND NEW.assigned_by <> NEW.user_id THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, link, entidade_tipo, entidade_id)
    VALUES (
      NEW.user_id,
      'tarefa_atribuida',
      'Nova tarefa atribuída',
      NEW.titulo,
      '/minhas-tarefas',
      'todo',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_todo_atribuida
AFTER INSERT ON public.todo_pessoal
FOR EACH ROW EXECUTE FUNCTION public.notify_todo_atribuida();

-- 4) Trigger: mudança de etapa em projeto
CREATE OR REPLACE FUNCTION public.notify_projeto_etapa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
  v_cliente_nome text;
  v_etapa_nome text;
BEGIN
  IF NEW.etapa_id IS DISTINCT FROM OLD.etapa_id THEN
    v_user := public.get_user_id_for_consultor(NEW.consultor_id);
    IF v_user IS NOT NULL AND v_user <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
      SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = NEW.cliente_id;
      SELECT nome INTO v_etapa_nome FROM public.projetos_etapas WHERE id = NEW.etapa_id;
      INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, link, entidade_tipo, entidade_id)
      VALUES (
        v_user,
        'projeto_etapa',
        'Projeto movido de etapa',
        COALESCE(v_cliente_nome, 'Projeto') || ' → ' || COALESCE(v_etapa_nome, 'nova etapa'),
        '/projetos',
        'projeto',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_projeto_etapa
AFTER UPDATE ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.notify_projeto_etapa();

-- 5) Trigger: comentário em projeto
CREATE OR REPLACE FUNCTION public.notify_projeto_comentario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_consultor_id uuid;
  v_user uuid;
  v_cliente_nome text;
BEGIN
  SELECT p.consultor_id, c.nome
    INTO v_consultor_id, v_cliente_nome
  FROM public.projetos p
  LEFT JOIN public.clientes c ON c.id = p.cliente_id
  WHERE p.id = NEW.projeto_id;

  v_user := public.get_user_id_for_consultor(v_consultor_id);
  IF v_user IS NOT NULL AND v_user <> NEW.user_id THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, link, entidade_tipo, entidade_id)
    VALUES (
      v_user,
      'projeto_comentario',
      'Novo comentário em ' || COALESCE(v_cliente_nome, 'projeto'),
      LEFT(NEW.texto, 140),
      '/projetos',
      'projeto',
      NEW.projeto_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_projeto_comentario
AFTER INSERT ON public.projeto_comentarios
FOR EACH ROW EXECUTE FUNCTION public.notify_projeto_comentario();

-- 6) Trigger: checklist concluído → notifica responsáveis (exceto quem marcou)
CREATE OR REPLACE FUNCTION public.notify_checklist_concluido()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cliente_nome text;
  v_proj_id uuid;
  r RECORD;
  v_user uuid;
BEGIN
  IF NEW.concluido = true AND COALESCE(OLD.concluido, false) = false THEN
    SELECT p.id, c.nome INTO v_proj_id, v_cliente_nome
    FROM public.projetos p
    LEFT JOIN public.clientes c ON c.id = p.cliente_id
    WHERE p.id = NEW.projeto_id;

    FOR r IN
      SELECT consultor_id FROM public.projeto_checklist_responsaveis WHERE checklist_item_id = NEW.id
    LOOP
      v_user := public.get_user_id_for_consultor(r.consultor_id);
      IF v_user IS NOT NULL AND v_user <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, link, entidade_tipo, entidade_id)
        VALUES (
          v_user,
          'checklist_concluido',
          'Tarefa concluída',
          NEW.titulo || COALESCE(' • ' || v_cliente_nome, ''),
          '/projetos',
          'projeto',
          v_proj_id
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_checklist_concluido
AFTER UPDATE ON public.projeto_checklist
FOR EACH ROW EXECUTE FUNCTION public.notify_checklist_concluido();

-- 7) Trigger: questionário respondido / finalizado
CREATE OR REPLACE FUNCTION public.notify_questionario_finalizado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_consultor_id uuid;
  v_user uuid;
  v_cliente_nome text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('respondido','finalizado','concluido') THEN
    SELECT consultor_id, nome INTO v_consultor_id, v_cliente_nome
    FROM public.clientes WHERE id = NEW.cliente_id;
    v_user := public.get_user_id_for_consultor(v_consultor_id);
    IF v_user IS NOT NULL THEN
      INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, link, entidade_tipo, entidade_id)
      VALUES (
        v_user,
        'questionario_finalizado',
        'Questionário de onboarding finalizado',
        COALESCE(v_cliente_nome, 'Cliente') || ' concluiu o questionário.',
        '/clientes/' || NEW.cliente_id::text,
        'cliente',
        NEW.cliente_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_questionario_finalizado
AFTER UPDATE ON public.questionarios
FOR EACH ROW EXECUTE FUNCTION public.notify_questionario_finalizado();

-- 8) Função para contratos próximos do vencimento (chamável via cron)
CREATE OR REPLACE FUNCTION public.gerar_notificacoes_contratos_vencendo()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  v_user uuid;
  v_dias integer;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT c.id AS contrato_id, c.cliente_id, c.data_fim, cl.consultor_id, cl.nome AS cliente_nome,
           (c.data_fim - CURRENT_DATE) AS dias
    FROM public.contratos c
    JOIN public.clientes cl ON cl.id = c.cliente_id
    WHERE c.ativo = true
      AND c.encerrado_em IS NULL
      AND (c.data_fim - CURRENT_DATE) IN (90, 60, 30)
  LOOP
    v_user := public.get_user_id_for_consultor(r.consultor_id);
    v_dias := r.dias;
    IF v_user IS NULL THEN CONTINUE; END IF;
    -- evita duplicar no mesmo dia/marco
    IF EXISTS (
      SELECT 1 FROM public.notificacoes n
      WHERE n.user_id = v_user
        AND n.tipo = 'contrato_vencendo'
        AND n.entidade_id = r.contrato_id
        AND n.descricao LIKE '%' || v_dias || ' dias%'
        AND n.created_at::date = CURRENT_DATE
    ) THEN CONTINUE; END IF;

    INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, link, entidade_tipo, entidade_id)
    VALUES (
      v_user,
      'contrato_vencendo',
      'Contrato próximo do vencimento',
      r.cliente_nome || ' • vence em ' || v_dias || ' dias (' || to_char(r.data_fim, 'DD/MM/YYYY') || ')',
      '/clientes/' || r.cliente_id::text,
      'contrato',
      r.contrato_id
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
