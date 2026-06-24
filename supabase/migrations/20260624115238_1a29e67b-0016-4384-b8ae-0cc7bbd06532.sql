
-- Documentos sincronizados do Notion
CREATE TABLE public.notion_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id text UNIQUE NOT NULL,
  data_source_id text NOT NULL,
  title text,
  content text,
  url text,
  last_edited_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notion_documents TO authenticated;
GRANT ALL ON public.notion_documents TO service_role;

ALTER TABLE public.notion_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can read notion documents"
  ON public.notion_documents FOR SELECT
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE INDEX notion_documents_data_source_idx ON public.notion_documents (data_source_id);
CREATE INDEX notion_documents_search_idx ON public.notion_documents
  USING gin (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(content, '')));

CREATE TRIGGER notion_documents_updated_at
  BEFORE UPDATE ON public.notion_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Conversas do Oráculo
CREATE TABLE public.oraculo_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text,
  contexto_origem jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oraculo_conversas TO authenticated;
GRANT ALL ON public.oraculo_conversas TO service_role;

ALTER TABLE public.oraculo_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own conversas select"
  ON public.oraculo_conversas FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage own conversas insert"
  ON public.oraculo_conversas FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own conversas update"
  ON public.oraculo_conversas FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own conversas delete"
  ON public.oraculo_conversas FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX oraculo_conversas_user_idx ON public.oraculo_conversas (user_id, updated_at DESC);

CREATE TRIGGER oraculo_conversas_updated_at
  BEFORE UPDATE ON public.oraculo_conversas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mensagens das conversas
CREATE TABLE public.oraculo_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.oraculo_conversas(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oraculo_mensagens TO authenticated;
GRANT ALL ON public.oraculo_mensagens TO service_role;

ALTER TABLE public.oraculo_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read messages of own conversas"
  ON public.oraculo_mensagens FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.oraculo_conversas c WHERE c.id = conversa_id AND c.user_id = auth.uid())
  );
CREATE POLICY "Users insert messages in own conversas"
  ON public.oraculo_mensagens FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.oraculo_conversas c WHERE c.id = conversa_id AND c.user_id = auth.uid())
  );
CREATE POLICY "Users delete messages of own conversas"
  ON public.oraculo_mensagens FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.oraculo_conversas c WHERE c.id = conversa_id AND c.user_id = auth.uid())
  );

CREATE INDEX oraculo_mensagens_conversa_idx ON public.oraculo_mensagens (conversa_id, created_at);
