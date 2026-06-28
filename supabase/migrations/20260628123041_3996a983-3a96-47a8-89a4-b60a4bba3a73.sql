CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_consultoria_id uuid NOT NULL REFERENCES public.tipos_consultoria(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.checklist_templates TO authenticated;
GRANT ALL ON public.checklist_templates TO service_role;

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read templates"
  ON public.checklist_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert templates"
  ON public.checklist_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update templates"
  ON public.checklist_templates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete templates"
  ON public.checklist_templates FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_checklist_templates_tipo ON public.checklist_templates(tipo_consultoria_id, ordem);

DO $$
DECLARE
  v_id uuid;
BEGIN
SELECT id INTO v_id FROM tipos_consultoria WHERE nome ILIKE '%Gestão Imobiliária Avançada%' AND nome ILIKE '%Aluguel%' AND nome ILIKE '%Venda%' LIMIT 1;
IF v_id IS NOT NULL THEN
  INSERT INTO checklist_templates (tipo_consultoria_id, titulo, ordem) VALUES
  (v_id, 'Enviar questionário pré-imersão ao cliente', 1),
  (v_id, 'Realizar imersão presencial (até 3 dias)', 2),
  (v_id, 'Entregar Raio-X da Operação (Locação e Venda)', 3),
  (v_id, 'Apresentar Raio-X em reunião online (até 15 dias após imersão)', 4),
  (v_id, 'Construir Roadmap de Aceleração (metas 6 e 12 meses)', 5),
  (v_id, 'Entregar Relatório de IA personalizado para a operação', 6),
  (v_id, 'Construir Matrizes de Responsabilidades (RACI)', 7),
  (v_id, 'Diagnóstico e Otimização de Sistemas (CRM e ERP)', 8),
  (v_id, 'Treinamento de boas práticas de CRM para equipe comercial', 9),
  (v_id, 'Treinamento de OKR para gestores', 10),
  (v_id, 'Construir OKRs do 1º trimestre', 11),
  (v_id, 'Realizar 1º Cliente Oculto digital (Locação e Venda — 2 personas)', 12),
  (v_id, 'Implementar Dashimob (cultura de dados)', 13),
  (v_id, 'Implementar Roleplay comercial (4 simulações)', 14),
  (v_id, 'Construir OKRs do 2º trimestre', 15),
  (v_id, 'Realizar 2º Cliente Oculto digital (2 personas)', 16),
  (v_id, 'Construir OKRs do 3º trimestre', 17),
  (v_id, 'Realizar 3º Cliente Oculto digital (2 personas)', 18),
  (v_id, 'Refinamento de processos implementados (RACI, Roleplay etc.)', 19),
  (v_id, 'Entregar Balanço de Performance final', 20);
END IF;

SELECT id INTO v_id FROM tipos_consultoria WHERE nome ILIKE '%Gestão Imobiliária Avançada%' AND nome ILIKE '%Aluguel%' AND nome NOT ILIKE '%Venda%' LIMIT 1;
IF v_id IS NOT NULL THEN
  INSERT INTO checklist_templates (tipo_consultoria_id, titulo, ordem) VALUES
  (v_id, 'Enviar questionário pré-imersão ao cliente', 1),
  (v_id, 'Realizar imersão presencial (até 2 dias)', 2),
  (v_id, 'Entregar Raio-X da Operação de Locação', 3),
  (v_id, 'Apresentar Raio-X em reunião online (até 15 dias após imersão)', 4),
  (v_id, 'Construir Roadmap de Aceleração (metas 6 e 12 meses)', 5),
  (v_id, 'Entregar Relatório de rentabilização para locação', 6),
  (v_id, 'Entregar Relatório de IA personalizado para a operação', 7),
  (v_id, 'Construir Matrizes de Responsabilidades (RACI)', 8),
  (v_id, 'Diagnóstico e Otimização de Sistemas (CRM e ERP)', 9),
  (v_id, 'Treinamento de OKR para gestores', 10),
  (v_id, 'Construir OKRs do 1º trimestre', 11),
  (v_id, 'Realizar 1º Cliente Oculto digital — Locação (2 personas)', 12),
  (v_id, 'Implementar Dashimob (cultura de dados)', 13),
  (v_id, 'Implementar Roleplay comercial (4 simulações)', 14),
  (v_id, 'Construir OKRs do 2º trimestre', 15),
  (v_id, 'Realizar 2º Cliente Oculto digital (2 personas)', 16),
  (v_id, 'Construir OKRs do 3º trimestre', 17),
  (v_id, 'Realizar 3º Cliente Oculto digital (2 personas)', 18),
  (v_id, 'Refinamento de processos implementados', 19),
  (v_id, 'Entregar Balanço de Performance final', 20);
END IF;

SELECT id INTO v_id FROM tipos_consultoria WHERE nome ILIKE '%Gestão Imobiliária Avançada%' AND nome ILIKE '%Venda%' AND nome NOT ILIKE '%Aluguel%' LIMIT 1;
IF v_id IS NOT NULL THEN
  INSERT INTO checklist_templates (tipo_consultoria_id, titulo, ordem) VALUES
  (v_id, 'Enviar questionário pré-imersão ao cliente', 1),
  (v_id, 'Realizar imersão presencial (até 2 dias)', 2),
  (v_id, 'Entregar Raio-X da Operação de Venda', 3),
  (v_id, 'Apresentar Raio-X em reunião online (até 15 dias após imersão)', 4),
  (v_id, 'Construir Roadmap de Aceleração (metas 6 e 12 meses)', 5),
  (v_id, 'Entregar Relatório de IA personalizado para a operação', 6),
  (v_id, 'Construir Matrizes de Responsabilidades (RACI)', 7),
  (v_id, 'Diagnóstico e Otimização de Sistemas (CRM e ERP)', 8),
  (v_id, 'Treinamento de OKR para gestores', 9),
  (v_id, 'Construir OKRs do 1º trimestre', 10),
  (v_id, 'Realizar 1º Cliente Oculto digital — Venda (2 personas)', 11),
  (v_id, 'Implementar Dashimob (cultura de dados)', 12),
  (v_id, 'Implementar Roleplay comercial (4 simulações)', 13),
  (v_id, 'Construir OKRs do 2º trimestre', 14),
  (v_id, 'Realizar 2º Cliente Oculto digital (2 personas)', 15),
  (v_id, 'Construir OKRs do 3º trimestre', 16),
  (v_id, 'Realizar 3º Cliente Oculto digital (2 personas)', 17),
  (v_id, 'Refinamento de processos implementados', 18),
  (v_id, 'Entregar Balanço de Performance final', 19);
END IF;

SELECT id INTO v_id FROM tipos_consultoria WHERE nome ILIKE '%Mapeamento%' AND nome ILIKE '%Aluguel%' AND nome ILIKE '%Venda%' LIMIT 1;
IF v_id IS NOT NULL THEN
  INSERT INTO checklist_templates (tipo_consultoria_id, titulo, ordem) VALUES
  (v_id, 'Enviar questionário pré-imersão ao cliente', 1),
  (v_id, 'Realizar imersão presencial (até 3 dias)', 2),
  (v_id, 'Entregar Raio-X da Operação (Aluguel e Venda)', 3),
  (v_id, 'Entregar Mapa de Oportunidades (matriz Esforço vs. Impacto)', 4),
  (v_id, 'Entregar Relatório de IA personalizado para a operação', 5),
  (v_id, 'Diagnóstico e Otimização de Sistemas (CRM e ERP)', 6),
  (v_id, 'Realizar Cliente Oculto digital (Aluguel e Venda — 2 personas)', 7),
  (v_id, 'Realizar Reunião Final de Alinhamento e Próximos Passos', 8);
END IF;

SELECT id INTO v_id FROM tipos_consultoria WHERE nome ILIKE '%Mapeamento%' AND nome ILIKE '%Aluguel%' AND nome NOT ILIKE '%Venda%' LIMIT 1;
IF v_id IS NOT NULL THEN
  INSERT INTO checklist_templates (tipo_consultoria_id, titulo, ordem) VALUES
  (v_id, 'Enviar questionário pré-imersão ao cliente', 1),
  (v_id, 'Realizar imersão presencial (até 2 dias)', 2),
  (v_id, 'Entregar Raio-X da Operação de Locação', 3),
  (v_id, 'Entregar Mapa de Oportunidades (matriz Esforço vs. Impacto)', 4),
  (v_id, 'Entregar Relatório de IA personalizado para a operação', 5),
  (v_id, 'Diagnóstico e Otimização de Sistemas (CRM e ERP)', 6),
  (v_id, 'Realizar Cliente Oculto digital — Aluguel (2 personas)', 7),
  (v_id, 'Realizar Reunião Final de Alinhamento e Próximos Passos', 8);
END IF;

SELECT id INTO v_id FROM tipos_consultoria WHERE nome ILIKE '%Mapeamento%' AND nome ILIKE '%Venda%' AND nome NOT ILIKE '%Aluguel%' LIMIT 1;
IF v_id IS NOT NULL THEN
  INSERT INTO checklist_templates (tipo_consultoria_id, titulo, ordem) VALUES
  (v_id, 'Enviar questionário pré-imersão ao cliente', 1),
  (v_id, 'Realizar imersão presencial (até 2 dias)', 2),
  (v_id, 'Entregar Raio-X da Operação de Venda', 3),
  (v_id, 'Entregar Mapa de Oportunidades (matriz Esforço vs. Impacto)', 4),
  (v_id, 'Entregar Relatório de IA personalizado para a operação', 5),
  (v_id, 'Diagnóstico e Otimização de Sistemas (CRM)', 6),
  (v_id, 'Realizar Cliente Oculto digital — Venda (2 personas)', 7),
  (v_id, 'Realizar Reunião Final de Alinhamento e Próximos Passos', 8);
END IF;

SELECT id INTO v_id FROM tipos_consultoria WHERE (nome ILIKE '%Implantar%' OR nome ILIKE '%Implantação%') AND nome ILIKE '%Aluguel%' AND nome NOT ILIKE '%Assessoria%' AND nome NOT ILIKE '%Processo%' LIMIT 1;
IF v_id IS NOT NULL THEN
  INSERT INTO checklist_templates (tipo_consultoria_id, titulo, ordem) VALUES
  (v_id, 'Realizar imersão online (8 horas)', 1),
  (v_id, 'Entregar Relatório de Imersão e Planejamento', 2),
  (v_id, 'Realizar Cliente Oculto digital em 2 concorrentes', 3),
  (v_id, 'Apresentar relatório e alinhamento (até 30 dias após imersão)', 4),
  (v_id, 'Acompanhamento quinzenal — Mês 2: Marketing e posicionamento', 5),
  (v_id, 'Acompanhamento quinzenal — Mês 2: Sistemas e tecnologia', 6),
  (v_id, 'Acompanhamento quinzenal — Mês 3: Processo comercial de locação', 7),
  (v_id, 'Acompanhamento quinzenal — Mês 3: Captação de imóveis', 8),
  (v_id, 'Acompanhamento quinzenal — Mês 4: Processos administrativos', 9),
  (v_id, 'Acompanhamento quinzenal — Mês 4: Contratos e análise cadastral', 10),
  (v_id, 'Acompanhamento quinzenal — Mês 5: Gestão de equipe', 11),
  (v_id, 'Acompanhamento quinzenal — Mês 5: Metas e cultura de dados', 12),
  (v_id, 'Acompanhamento quinzenal — Mês 6: Revisão geral e próximos passos', 13);
END IF;

SELECT id INTO v_id FROM tipos_consultoria WHERE nome ILIKE '%Implantar%' AND nome ILIKE '%Aluguel%' AND (nome ILIKE '%Assessoria%' OR nome ILIKE '%Processo%') LIMIT 1;
IF v_id IS NOT NULL THEN
  INSERT INTO checklist_templates (tipo_consultoria_id, titulo, ordem) VALUES
  (v_id, 'Realizar imersão online (8 horas)', 1),
  (v_id, 'Entregar Relatório de Imersão e Planejamento', 2),
  (v_id, 'Realizar Cliente Oculto digital em 2 concorrentes', 3),
  (v_id, 'Apresentar relatório e alinhar cronograma semanal', 4),
  (v_id, 'Construir processos comerciais — Captação de Imóveis', 5),
  (v_id, 'Construir processos comerciais — Pré-atendimento e Qualificação', 6),
  (v_id, 'Construir processos comerciais — Atendimento ao Locatário', 7),
  (v_id, 'Construir processos administrativos — Contratos e Análise Cadastral', 8),
  (v_id, 'Construir processos administrativos — Manutenção', 9),
  (v_id, 'Construir processos administrativos — Desocupação', 10),
  (v_id, 'Construir processos administrativos — Atendimento Geral', 11),
  (v_id, 'Entregar modelos e materiais personalizados (Playbook, Guias, Manuais)', 12),
  (v_id, 'Revisão geral e encerramento do projeto', 13);
END IF;

SELECT id INTO v_id FROM tipos_consultoria WHERE nome ILIKE '%começar%' AND nome ILIKE '%Vend%' LIMIT 1;
IF v_id IS NOT NULL THEN
  INSERT INTO checklist_templates (tipo_consultoria_id, titulo, ordem) VALUES
  (v_id, 'Realizar reunião de alinhamento online (4 horas)', 1),
  (v_id, 'Entregar proposta de projeto e planejamento inicial', 2),
  (v_id, 'Realizar Cliente Oculto digital em 1 concorrente', 3),
  (v_id, 'Apresentar proposta completa (até 20 dias após reunião inicial)', 4),
  (v_id, 'Acompanhamento quinzenal — Meses 1-2: Estratégia e posicionamento', 5),
  (v_id, 'Acompanhamento quinzenal — Meses 2-3: Estrutura comercial', 6),
  (v_id, 'Acompanhamento quinzenal — Meses 3-4: Gestão de equipe', 7),
  (v_id, 'Acompanhamento quinzenal — Meses 4-5: Sistemas e tecnologia', 8),
  (v_id, 'Acompanhamento quinzenal — Meses 5-6: Metas e cultura de dados', 9),
  (v_id, 'Revisão geral e encerramento do projeto', 10);
END IF;

SELECT id INTO v_id FROM tipos_consultoria WHERE nome ILIKE '%Alta Performance%' AND nome ILIKE '%Captação%' LIMIT 1;
IF v_id IS NOT NULL THEN
  INSERT INTO checklist_templates (tipo_consultoria_id, titulo, ordem) VALUES
  (v_id, 'Enviar questionário pré-imersão ao cliente', 1),
  (v_id, 'Realizar imersão online (até 6 horas)', 2),
  (v_id, 'Definir cronograma de entregas', 3),
  (v_id, 'Criar Proposta Única de Valor (PUV) para o Proprietário', 4),
  (v_id, 'Analisar e estruturar Pacote de Serviços de Administração', 5),
  (v_id, 'Elaborar Plano Estratégico de Alavancagem de Captação', 6),
  (v_id, 'Desenhar perfil e descritivo de cargo do Captador', 7),
  (v_id, 'Entregar Playbook Completo de Captação', 8),
  (v_id, 'Estruturar metas e comissões para o time', 9),
  (v_id, 'Implementar Rituais de Gestão de Captação', 10),
  (v_id, 'Realizar Roleplays de captação (4 simulações)', 11),
  (v_id, 'Definir KPIs e controle de performance', 12),
  (v_id, 'Liberar acesso Aluguel Essencial (60 dias)', 13),
  (v_id, 'Realizar 6 encontros de acompanhamento online', 14);
END IF;

SELECT id INTO v_id FROM tipos_consultoria WHERE nome ILIKE '%Alta Performance%' AND nome ILIKE '%Comercial%' LIMIT 1;
IF v_id IS NOT NULL THEN
  INSERT INTO checklist_templates (tipo_consultoria_id, titulo, ordem) VALUES
  (v_id, 'Enviar questionário pré-imersão ao cliente', 1),
  (v_id, 'Realizar imersão online (até 6 horas)', 2),
  (v_id, 'Definir cronograma de entregas', 3),
  (v_id, 'Criar Proposta de Valor para o Inquilino', 4),
  (v_id, 'Desenhar Jornada do Cliente e Funil de Atendimento', 5),
  (v_id, 'Entregar Playbook Completo de Atendimento de Locação', 6),
  (v_id, 'Entregar Diagnóstico e Estratégia de IA no processo comercial', 7),
  (v_id, 'Estruturar metas para o time (gameficação)', 8),
  (v_id, 'Implementar Rituais de Gestão Comercial', 9),
  (v_id, 'Capacitar equipe em boas práticas de CRM', 10),
  (v_id, 'Definir KPIs e controle de performance', 11),
  (v_id, 'Liberar acesso Aluguel Essencial (60 dias)', 12),
  (v_id, 'Realizar 6 encontros de acompanhamento online', 13);
END IF;

SELECT id INTO v_id FROM tipos_consultoria WHERE nome ILIKE '%IA%' AND nome ILIKE '%Aluguel%' AND nome NOT ILIKE '%Venda%' LIMIT 1;
IF v_id IS NOT NULL THEN
  INSERT INTO checklist_templates (tipo_consultoria_id, titulo, ordem) VALUES
  (v_id, 'Enviar questionário pré-imersão ao cliente', 1),
  (v_id, 'Realizar imersão online (até 3 horas)', 2),
  (v_id, 'Definir cronograma de entregas', 3),
  (v_id, 'Definir objetivos e papel da IA na operação', 4),
  (v_id, 'Realizar curadoria e seleção de parceiro tecnológico (até 3 indicações)', 5),
  (v_id, 'Acompanhar demonstrações com fornecedores', 6),
  (v_id, 'Desenhar novos fluxos de atendimento com IA', 7),
  (v_id, 'Criar Playbook de estratégia de IA (Árvore de Decisão, Scripts, Templates)', 8),
  (v_id, 'Acompanhar configuração e setup técnico da ferramenta', 9),
  (v_id, 'Realizar projeto piloto e validação de fluxos', 10),
  (v_id, 'Definir KPIs por operação', 11),
  (v_id, 'Implementar rotina de gestão e otimização', 12),
  (v_id, 'Capacitar equipe na operação dos leads qualificados por IA', 13),
  (v_id, 'Realizar 4 encontros de acompanhamento online', 14);
END IF;

SELECT id INTO v_id FROM tipos_consultoria WHERE nome ILIKE '%IA%' AND nome ILIKE '%Aluguel%' AND nome ILIKE '%Venda%' LIMIT 1;
IF v_id IS NOT NULL THEN
  INSERT INTO checklist_templates (tipo_consultoria_id, titulo, ordem) VALUES
  (v_id, 'Enviar questionário pré-imersão ao cliente', 1),
  (v_id, 'Realizar imersão online (até 6 horas)', 2),
  (v_id, 'Definir cronograma de entregas', 3),
  (v_id, 'Definir objetivos e papel da IA (Locação e Venda)', 4),
  (v_id, 'Realizar curadoria e seleção de parceiro tecnológico (até 3 indicações)', 5),
  (v_id, 'Acompanhar demonstrações com fornecedores', 6),
  (v_id, 'Desenhar fluxos de atendimento com IA — Locação', 7),
  (v_id, 'Desenhar fluxos de atendimento com IA — Venda', 8),
  (v_id, 'Criar Playbook de estratégia de IA (Locação e Venda)', 9),
  (v_id, 'Acompanhar configuração e setup técnico da ferramenta', 10),
  (v_id, 'Realizar projeto piloto e validação de fluxos', 11),
  (v_id, 'Definir KPIs por operação (Locação e Venda)', 12),
  (v_id, 'Implementar rotina de gestão e otimização', 13),
  (v_id, 'Capacitar equipes (Locação e Venda) na operação dos leads', 14),
  (v_id, 'Realizar 4 encontros de acompanhamento online', 15);
END IF;

END $$;