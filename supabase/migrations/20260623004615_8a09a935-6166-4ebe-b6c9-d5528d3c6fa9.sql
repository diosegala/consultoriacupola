
CREATE TABLE public.questionarios_template (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  versao INT NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  estrutura JSONB NOT NULL DEFAULT '{"secoes":[]}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionarios_template TO authenticated;
GRANT ALL ON public.questionarios_template TO service_role;

ALTER TABLE public.questionarios_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can read templates"
  ON public.questionarios_template FOR SELECT TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Admins manage templates"
  ON public.questionarios_template FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role));

CREATE TRIGGER update_questionarios_template_updated_at
  BEFORE UPDATE ON public.questionarios_template
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.questionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.questionarios_template(id),
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status TEXT NOT NULL DEFAULT 'nao_iniciado',
  progresso_pct INT NOT NULL DEFAULT 0,
  respostas JSONB NOT NULL DEFAULT '{}'::jsonb,
  iniciado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  ultimo_salvamento_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT questionarios_status_check CHECK (status IN ('nao_iniciado','em_andamento','concluido','arquivado'))
);

CREATE INDEX idx_questionarios_cliente ON public.questionarios(cliente_id);
CREATE UNIQUE INDEX idx_questionarios_cliente_ativo
  ON public.questionarios(cliente_id)
  WHERE status <> 'arquivado';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionarios TO authenticated;
GRANT ALL ON public.questionarios TO service_role;

ALTER TABLE public.questionarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can read questionarios"
  ON public.questionarios FOR SELECT TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can insert questionarios"
  ON public.questionarios FOR INSERT TO authenticated
  WITH CHECK (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can update questionarios"
  ON public.questionarios FOR UPDATE TO authenticated
  USING (public.is_authorized_user(auth.uid()))
  WITH CHECK (public.is_authorized_user(auth.uid()));

CREATE POLICY "Admins can delete questionarios"
  ON public.questionarios FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role));

CREATE TRIGGER update_questionarios_updated_at
  BEFORE UPDATE ON public.questionarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.questionarios_template (nome, versao, ativo, estrutura) VALUES (
  'Pré-Onboarding CUPOLA',
  1,
  true,
  '{
    "secoes": [
      {
        "id": "empresa",
        "titulo": "Sobre a empresa",
        "descricao": "Informações gerais sobre o seu negócio.",
        "perguntas": [
          { "id": "razao_social", "tipo": "texto_curto", "label": "Razão social", "obrigatorio": true },
          { "id": "nome_fantasia", "tipo": "texto_curto", "label": "Nome fantasia", "obrigatorio": false },
          { "id": "segmento", "tipo": "escolha_unica", "label": "Segmento de atuação", "opcoes": ["B2B","B2C","Ambos"], "obrigatorio": true },
          { "id": "fundacao", "tipo": "data", "label": "Data de fundação", "obrigatorio": false },
          { "id": "n_funcionarios", "tipo": "numero", "label": "Número de funcionários", "obrigatorio": false },
          { "id": "descricao", "tipo": "texto_longo", "label": "Descreva brevemente o que sua empresa faz", "obrigatorio": true }
        ]
      },
      {
        "id": "objetivos",
        "titulo": "Objetivos com a consultoria",
        "descricao": "Conte para nós o que você espera alcançar.",
        "perguntas": [
          { "id": "principal_objetivo", "tipo": "texto_longo", "label": "Qual o principal objetivo com a consultoria?", "obrigatorio": true },
          { "id": "prioridade", "tipo": "escolha_unica", "label": "Maior prioridade no momento", "opcoes": ["Vendas","Marketing","Processos","Pessoas","Financeiro","Outro"], "obrigatorio": true },
          { "id": "urgencia", "tipo": "escala_1_10", "label": "Em uma escala de 1 a 10, qual a urgência dessas mudanças?", "obrigatorio": true },
          { "id": "ja_tentou", "tipo": "sim_nao", "label": "Já tentou resolver esse desafio antes?", "obrigatorio": true },
          { "id": "ja_tentou_como", "tipo": "texto_longo", "label": "Se sim, como? O que funcionou e o que não funcionou?", "obrigatorio": false }
        ]
      }
    ]
  }'::jsonb
);
