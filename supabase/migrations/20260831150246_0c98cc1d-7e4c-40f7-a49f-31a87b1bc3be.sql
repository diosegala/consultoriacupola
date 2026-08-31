-- 1) Tabelas
CREATE TABLE public.chat_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'direta',
  nome text,
  criado_por uuid NOT NULL,
  ultima_mensagem_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.chat_conversas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  ultima_leitura_em timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  arquivada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversa_id, user_id)
);

CREATE TABLE public.chat_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.chat_conversas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  conteudo text NOT NULL DEFAULT '',
  anexo_url text,
  anexo_nome text,
  anexo_tipo text,
  anexo_tamanho bigint,
  reply_to_id uuid REFERENCES public.chat_mensagens(id) ON DELETE SET NULL,
  editada_em timestamptz,
  deletada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_participantes_user ON public.chat_participantes(user_id);
CREATE INDEX idx_chat_participantes_conversa ON public.chat_participantes(conversa_id);
CREATE INDEX idx_chat_mensagens_conversa_created ON public.chat_mensagens(conversa_id, created_at DESC);
CREATE INDEX idx_chat_conversas_ultima ON public.chat_conversas(ultima_mensagem_em DESC);

-- 2) GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversas TO authenticated;
GRANT ALL ON public.chat_conversas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_participantes TO authenticated;
GRANT ALL ON public.chat_participantes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_mensagens TO authenticated;
GRANT ALL ON public.chat_mensagens TO service_role;

-- 3) Função auxiliar (evita recursão de RLS)
CREATE OR REPLACE FUNCTION public.is_chat_participante(_conversa_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participantes
    WHERE conversa_id = _conversa_id AND user_id = _user_id
  )
$$;

-- Chave canônica para conversa direta (par ordenado de user_ids)
CREATE OR REPLACE FUNCTION public.chat_direta_key(_conversa_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT string_agg(user_id::text, '|' ORDER BY user_id)
  FROM public.chat_participantes WHERE conversa_id = _conversa_id
$$;

-- 4) RLS
ALTER TABLE public.chat_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversas_select_participante" ON public.chat_conversas
  FOR SELECT TO authenticated
  USING (public.is_chat_participante(id, auth.uid()));

CREATE POLICY "conversas_insert_autorizado" ON public.chat_conversas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_authorized_user(auth.uid()) AND criado_por = auth.uid());

CREATE POLICY "conversas_update_participante" ON public.chat_conversas
  FOR UPDATE TO authenticated
  USING (public.is_chat_participante(id, auth.uid()))
  WITH CHECK (public.is_chat_participante(id, auth.uid()));

CREATE POLICY "participantes_select" ON public.chat_participantes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_participante(conversa_id, auth.uid()));

CREATE POLICY "participantes_insert" ON public.chat_participantes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_authorized_user(auth.uid())
    AND (
      EXISTS (SELECT 1 FROM public.chat_conversas c WHERE c.id = conversa_id AND c.criado_por = auth.uid())
      OR public.is_chat_participante(conversa_id, auth.uid())
    )
  );

CREATE POLICY "participantes_update_proprio" ON public.chat_participantes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "participantes_delete_proprio" ON public.chat_participantes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "mensagens_select_participante" ON public.chat_mensagens
  FOR SELECT TO authenticated
  USING (public.is_chat_participante(conversa_id, auth.uid()));

CREATE POLICY "mensagens_insert_participante" ON public.chat_mensagens
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_chat_participante(conversa_id, auth.uid()));

CREATE POLICY "mensagens_update_autor" ON public.chat_mensagens
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "mensagens_delete_autor" ON public.chat_mensagens
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 5) Validação: reply_to_id deve pertencer à mesma conversa
CREATE OR REPLACE FUNCTION public.chat_validar_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reply_to_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.chat_mensagens m
      WHERE m.id = NEW.reply_to_id AND m.conversa_id = NEW.conversa_id
    ) THEN
      RAISE EXCEPTION 'A mensagem respondida não pertence a esta conversa';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chat_validar_reply
BEFORE INSERT ON public.chat_mensagens
FOR EACH ROW EXECUTE FUNCTION public.chat_validar_reply();

-- 6) Impede conversa direta duplicada entre o mesmo par
CREATE OR REPLACE FUNCTION public.chat_evitar_direta_duplicada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
  v_key text;
  v_qtd int;
BEGIN
  SELECT tipo INTO v_tipo FROM public.chat_conversas WHERE id = NEW.conversa_id;
  IF v_tipo <> 'direta' THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_qtd FROM public.chat_participantes WHERE conversa_id = NEW.conversa_id;
  IF v_qtd <> 2 THEN RETURN NEW; END IF;

  v_key := public.chat_direta_key(NEW.conversa_id);

  IF EXISTS (
    SELECT 1 FROM public.chat_conversas c
    WHERE c.tipo = 'direta'
      AND c.id <> NEW.conversa_id
      AND public.chat_direta_key(c.id) = v_key
  ) THEN
    RAISE EXCEPTION 'Já existe uma conversa direta entre estes usuários';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chat_evitar_direta_duplicada
AFTER INSERT ON public.chat_participantes
FOR EACH ROW EXECUTE FUNCTION public.chat_evitar_direta_duplicada();

-- 7) Atualiza conversa + notifica participantes
CREATE OR REPLACE FUNCTION public.chat_apos_mensagem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
  v_nome text;
  v_autor text;
  v_titulo text;
  r RECORD;
BEGIN
  UPDATE public.chat_conversas
     SET ultima_mensagem_em = NEW.created_at, updated_at = now()
   WHERE id = NEW.conversa_id;

  SELECT tipo, nome INTO v_tipo, v_nome FROM public.chat_conversas WHERE id = NEW.conversa_id;

  SELECT c.nome INTO v_autor
  FROM public.consultor_user cu
  JOIN public.consultores c ON c.id = cu.consultor_id
  WHERE cu.user_id = NEW.user_id
  LIMIT 1;

  v_autor := COALESCE(v_autor, 'Usuário');
  v_titulo := CASE WHEN v_tipo = 'grupo'
                   THEN v_autor || ' em ' || COALESCE(v_nome, 'grupo')
                   ELSE 'Nova mensagem de ' || v_autor END;

  FOR r IN
    SELECT user_id FROM public.chat_participantes
    WHERE conversa_id = NEW.conversa_id AND user_id <> NEW.user_id
  LOOP
    INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, link, entidade_tipo, entidade_id)
    VALUES (
      r.user_id,
      'mensagem_nova',
      v_titulo,
      LEFT(COALESCE(NULLIF(NEW.conteudo, ''), COALESCE(NEW.anexo_nome, 'Anexo')), 140),
      '/mensagens?c=' || NEW.conversa_id::text,
      'chat_conversa',
      NEW.conversa_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chat_apos_mensagem
AFTER INSERT ON public.chat_mensagens
FOR EACH ROW EXECUTE FUNCTION public.chat_apos_mensagem();

CREATE TRIGGER trg_chat_conversas_updated_at
BEFORE UPDATE ON public.chat_conversas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) Realtime
ALTER TABLE public.chat_conversas REPLICA IDENTITY FULL;
ALTER TABLE public.chat_participantes REPLICA IDENTITY FULL;
ALTER TABLE public.chat_mensagens REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participantes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_mensagens;