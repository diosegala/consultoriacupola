
-- consultor_google_tokens
CREATE TABLE public.consultor_google_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultor_id uuid NOT NULL UNIQUE,
  email_google text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  escopo text NOT NULL,
  pasta_meet_id text,
  ativo boolean NOT NULL DEFAULT true,
  ultima_sincronizacao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultor_google_tokens TO authenticated;
GRANT ALL ON public.consultor_google_tokens TO service_role;

ALTER TABLE public.consultor_google_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultor vê próprios tokens"
  ON public.consultor_google_tokens FOR SELECT TO authenticated
  USING (consultor_id = public.get_consultor_id_for_user(auth.uid()) OR public.is_authorized_user(auth.uid()));

CREATE POLICY "Consultor insere próprios tokens"
  ON public.consultor_google_tokens FOR INSERT TO authenticated
  WITH CHECK (consultor_id = public.get_consultor_id_for_user(auth.uid()) OR public.is_authorized_user(auth.uid()));

CREATE POLICY "Consultor atualiza próprios tokens"
  ON public.consultor_google_tokens FOR UPDATE TO authenticated
  USING (consultor_id = public.get_consultor_id_for_user(auth.uid()) OR public.is_authorized_user(auth.uid()));

CREATE POLICY "Consultor deleta próprios tokens"
  ON public.consultor_google_tokens FOR DELETE TO authenticated
  USING (consultor_id = public.get_consultor_id_for_user(auth.uid()) OR public.is_authorized_user(auth.uid()));

CREATE TRIGGER update_consultor_google_tokens_updated_at
  BEFORE UPDATE ON public.consultor_google_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- cliente_aliases
CREATE TABLE public.cliente_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL,
  alias text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, alias)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_aliases TO authenticated;
GRANT ALL ON public.cliente_aliases TO service_role;

ALTER TABLE public.cliente_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autorizados veem aliases"
  ON public.cliente_aliases FOR SELECT TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Autorizados inserem aliases"
  ON public.cliente_aliases FOR INSERT TO authenticated
  WITH CHECK (public.is_authorized_user(auth.uid()));

CREATE POLICY "Autorizados atualizam aliases"
  ON public.cliente_aliases FOR UPDATE TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Autorizados deletam aliases"
  ON public.cliente_aliases FOR DELETE TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE INDEX idx_cliente_aliases_cliente ON public.cliente_aliases(cliente_id);
CREATE INDEX idx_cliente_aliases_alias_lower ON public.cliente_aliases(lower(alias));

-- reunioes_importadas_log
CREATE TABLE public.reunioes_importadas_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  google_file_id text NOT NULL UNIQUE,
  consultor_id uuid NOT NULL,
  cliente_id uuid,
  reuniao_id uuid,
  nome_arquivo text,
  data_importacao timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'importado',
  erro text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reunioes_importadas_log TO authenticated;
GRANT ALL ON public.reunioes_importadas_log TO service_role;

ALTER TABLE public.reunioes_importadas_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultor vê próprio log"
  ON public.reunioes_importadas_log FOR SELECT TO authenticated
  USING (consultor_id = public.get_consultor_id_for_user(auth.uid()) OR public.is_authorized_user(auth.uid()));

CREATE POLICY "Consultor insere próprio log"
  ON public.reunioes_importadas_log FOR INSERT TO authenticated
  WITH CHECK (consultor_id = public.get_consultor_id_for_user(auth.uid()) OR public.is_authorized_user(auth.uid()));

CREATE INDEX idx_reunioes_log_consultor ON public.reunioes_importadas_log(consultor_id);
