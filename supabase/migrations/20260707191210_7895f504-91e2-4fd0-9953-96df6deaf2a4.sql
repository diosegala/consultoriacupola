
-- ============================================================
-- Helper: admin OR director
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin_or_director(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'admin'::app_role)
      OR public.has_role(_uid, 'director'::app_role)
$$;

-- ============================================================
-- CLIENTES
-- ============================================================
DROP POLICY IF EXISTS "Authorized users can view clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authorized users can insert clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authorized users can update clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authorized users can delete clientes" ON public.clientes;

CREATE POLICY "clientes_select" ON public.clientes FOR SELECT TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR consultor_id = public.get_consultor_id_for_user(auth.uid()));

CREATE POLICY "clientes_insert" ON public.clientes FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_director(auth.uid()));

CREATE POLICY "clientes_update" ON public.clientes FOR UPDATE TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR consultor_id = public.get_consultor_id_for_user(auth.uid()))
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR consultor_id = public.get_consultor_id_for_user(auth.uid()));

CREATE POLICY "clientes_delete" ON public.clientes FOR DELETE TO authenticated
USING (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- CONTRATOS
-- ============================================================
DROP POLICY IF EXISTS "Authorized users can view contratos" ON public.contratos;
DROP POLICY IF EXISTS "Authorized users can insert contratos" ON public.contratos;
DROP POLICY IF EXISTS "Authorized users can update contratos" ON public.contratos;
DROP POLICY IF EXISTS "Authorized users can delete contratos" ON public.contratos;

CREATE POLICY "contratos_select" ON public.contratos FOR SELECT TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c
                  WHERE c.id = contratos.cliente_id
                    AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));

CREATE POLICY "contratos_insert" ON public.contratos FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_director(auth.uid()));

CREATE POLICY "contratos_update" ON public.contratos FOR UPDATE TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c
                  WHERE c.id = contratos.cliente_id
                    AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())))
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c
                  WHERE c.id = contratos.cliente_id
                    AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));

CREATE POLICY "contratos_delete" ON public.contratos FOR DELETE TO authenticated
USING (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- Macro helper: tabelas escopadas por cliente_id
-- (atendimentos, onboarding, ferramentas_cliente, encerramentos)
-- ============================================================
-- ATENDIMENTOS
DROP POLICY IF EXISTS "Authorized users can view atendimentos" ON public.atendimentos;
DROP POLICY IF EXISTS "Authorized users can insert atendimentos" ON public.atendimentos;
DROP POLICY IF EXISTS "Authorized users can update atendimentos" ON public.atendimentos;
DROP POLICY IF EXISTS "Authorized users can delete atendimentos" ON public.atendimentos;

CREATE POLICY "atendimentos_select" ON public.atendimentos FOR SELECT TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = atendimentos.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "atendimentos_insert" ON public.atendimentos FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = atendimentos.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "atendimentos_update" ON public.atendimentos FOR UPDATE TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = atendimentos.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())))
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = atendimentos.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "atendimentos_delete" ON public.atendimentos FOR DELETE TO authenticated
USING (public.is_admin_or_director(auth.uid()));

-- ONBOARDING
DROP POLICY IF EXISTS "Authorized users can view onboarding" ON public.onboarding;
DROP POLICY IF EXISTS "Authorized users can insert onboarding" ON public.onboarding;
DROP POLICY IF EXISTS "Authorized users can update onboarding" ON public.onboarding;
DROP POLICY IF EXISTS "Authorized users can delete onboarding" ON public.onboarding;

CREATE POLICY "onboarding_select" ON public.onboarding FOR SELECT TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = onboarding.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "onboarding_insert" ON public.onboarding FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = onboarding.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "onboarding_update" ON public.onboarding FOR UPDATE TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = onboarding.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())))
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = onboarding.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "onboarding_delete" ON public.onboarding FOR DELETE TO authenticated
USING (public.is_admin_or_director(auth.uid()));

-- FERRAMENTAS_CLIENTE
DROP POLICY IF EXISTS "Authorized users can view ferramentas_cliente" ON public.ferramentas_cliente;
DROP POLICY IF EXISTS "Authorized users can insert ferramentas_cliente" ON public.ferramentas_cliente;
DROP POLICY IF EXISTS "Authorized users can update ferramentas_cliente" ON public.ferramentas_cliente;
DROP POLICY IF EXISTS "Authorized users can delete ferramentas_cliente" ON public.ferramentas_cliente;

CREATE POLICY "ferramentas_select" ON public.ferramentas_cliente FOR SELECT TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = ferramentas_cliente.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "ferramentas_insert" ON public.ferramentas_cliente FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = ferramentas_cliente.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "ferramentas_update" ON public.ferramentas_cliente FOR UPDATE TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = ferramentas_cliente.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())))
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = ferramentas_cliente.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "ferramentas_delete" ON public.ferramentas_cliente FOR DELETE TO authenticated
USING (public.is_admin_or_director(auth.uid()));

-- ENCERRAMENTOS
DROP POLICY IF EXISTS "Authorized users can view encerramentos" ON public.encerramentos;
DROP POLICY IF EXISTS "Authorized users can insert encerramentos" ON public.encerramentos;
DROP POLICY IF EXISTS "Authorized users can update encerramentos" ON public.encerramentos;
DROP POLICY IF EXISTS "Authorized users can delete encerramentos" ON public.encerramentos;

CREATE POLICY "encerramentos_select" ON public.encerramentos FOR SELECT TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = encerramentos.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "encerramentos_insert" ON public.encerramentos FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = encerramentos.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "encerramentos_update" ON public.encerramentos FOR UPDATE TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = encerramentos.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())))
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = encerramentos.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "encerramentos_delete" ON public.encerramentos FOR DELETE TO authenticated
USING (public.is_admin_or_director(auth.uid()));

-- PAUSAS_CONTRATO (tem cliente_id)
DROP POLICY IF EXISTS "Authorized users can view pausas_contrato" ON public.pausas_contrato;
DROP POLICY IF EXISTS "Authorized users can insert pausas_contrato" ON public.pausas_contrato;
DROP POLICY IF EXISTS "Authorized users can update pausas_contrato" ON public.pausas_contrato;
DROP POLICY IF EXISTS "Authorized users can delete pausas_contrato" ON public.pausas_contrato;

CREATE POLICY "pausas_select" ON public.pausas_contrato FOR SELECT TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = pausas_contrato.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "pausas_insert" ON public.pausas_contrato FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = pausas_contrato.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "pausas_update" ON public.pausas_contrato FOR UPDATE TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = pausas_contrato.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())))
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = pausas_contrato.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "pausas_delete" ON public.pausas_contrato FOR DELETE TO authenticated
USING (public.is_admin_or_director(auth.uid()));

-- VIAGENS_CONTRATO (via contrato -> cliente)
DROP POLICY IF EXISTS "Authorized users can view viagens_contrato" ON public.viagens_contrato;
DROP POLICY IF EXISTS "Authorized users can insert viagens_contrato" ON public.viagens_contrato;
DROP POLICY IF EXISTS "Authorized users can update viagens_contrato" ON public.viagens_contrato;
DROP POLICY IF EXISTS "Authorized users can delete viagens_contrato" ON public.viagens_contrato;

CREATE POLICY "viagens_select" ON public.viagens_contrato FOR SELECT TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.contratos ct
                  JOIN public.clientes c ON c.id = ct.cliente_id
                  WHERE ct.id = viagens_contrato.contrato_id
                    AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "viagens_insert" ON public.viagens_contrato FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.contratos ct
                  JOIN public.clientes c ON c.id = ct.cliente_id
                  WHERE ct.id = viagens_contrato.contrato_id
                    AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "viagens_update" ON public.viagens_contrato FOR UPDATE TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.contratos ct
                  JOIN public.clientes c ON c.id = ct.cliente_id
                  WHERE ct.id = viagens_contrato.contrato_id
                    AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())))
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.contratos ct
                  JOIN public.clientes c ON c.id = ct.cliente_id
                  WHERE ct.id = viagens_contrato.contrato_id
                    AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "viagens_delete" ON public.viagens_contrato FOR DELETE TO authenticated
USING (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- CONSULTORES
-- ============================================================
DROP POLICY IF EXISTS "Authorized users can view consultores" ON public.consultores;
DROP POLICY IF EXISTS "Authorized users can insert consultores" ON public.consultores;
DROP POLICY IF EXISTS "Authorized users can update consultores" ON public.consultores;
DROP POLICY IF EXISTS "Authorized users can delete consultores" ON public.consultores;

CREATE POLICY "consultores_select" ON public.consultores FOR SELECT TO authenticated USING (true);
CREATE POLICY "consultores_insert" ON public.consultores FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_director(auth.uid()));
CREATE POLICY "consultores_update" ON public.consultores FOR UPDATE TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR id = public.get_consultor_id_for_user(auth.uid()))
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR id = public.get_consultor_id_for_user(auth.uid()));
CREATE POLICY "consultores_delete" ON public.consultores FOR DELETE TO authenticated
USING (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- CLIENTE_ALIASES
-- ============================================================
DROP POLICY IF EXISTS "Autorizados veem aliases" ON public.cliente_aliases;
DROP POLICY IF EXISTS "Autorizados inserem aliases" ON public.cliente_aliases;
DROP POLICY IF EXISTS "Autorizados atualizam aliases" ON public.cliente_aliases;
DROP POLICY IF EXISTS "Autorizados deletam aliases" ON public.cliente_aliases;

CREATE POLICY "aliases_select" ON public.cliente_aliases FOR SELECT TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_aliases.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "aliases_insert" ON public.cliente_aliases FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_aliases.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "aliases_update" ON public.cliente_aliases FOR UPDATE TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_aliases.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "aliases_delete" ON public.cliente_aliases FOR DELETE TO authenticated
USING (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- CRMS
-- ============================================================
DROP POLICY IF EXISTS "Authorized users can view crms" ON public.crms;
DROP POLICY IF EXISTS "Authorized users can insert crms" ON public.crms;
DROP POLICY IF EXISTS "Authorized users can update crms" ON public.crms;
DROP POLICY IF EXISTS "Authorized users can delete crms" ON public.crms;

CREATE POLICY "crms_select" ON public.crms FOR SELECT TO authenticated USING (true);
CREATE POLICY "crms_write_admin_director" ON public.crms FOR ALL TO authenticated
USING (public.is_admin_or_director(auth.uid()))
WITH CHECK (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- TIPOS_CONSULTORIA
-- ============================================================
DROP POLICY IF EXISTS "Authorized users can view tipos_consultoria" ON public.tipos_consultoria;
DROP POLICY IF EXISTS "Authorized users can insert tipos_consultoria" ON public.tipos_consultoria;
DROP POLICY IF EXISTS "Authorized users can update tipos_consultoria" ON public.tipos_consultoria;
DROP POLICY IF EXISTS "Authorized users can delete tipos_consultoria" ON public.tipos_consultoria;

CREATE POLICY "tipos_select" ON public.tipos_consultoria FOR SELECT TO authenticated USING (true);
CREATE POLICY "tipos_write_admin_director" ON public.tipos_consultoria FOR ALL TO authenticated
USING (public.is_admin_or_director(auth.uid()))
WITH CHECK (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- CHECKLIST_TEMPLATES (broadening from admin-only to admin+director)
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Admins can update templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON public.checklist_templates;

CREATE POLICY "checklist_templates_write" ON public.checklist_templates FOR ALL TO authenticated
USING (public.is_admin_or_director(auth.uid()))
WITH CHECK (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- QUESTIONARIOS_TEMPLATE (already admin-only ALL; broaden)
-- ============================================================
DROP POLICY IF EXISTS "Admins manage templates" ON public.questionarios_template;
CREATE POLICY "questionarios_template_write" ON public.questionarios_template FOR ALL TO authenticated
USING (public.is_admin_or_director(auth.uid()))
WITH CHECK (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- PROJETOS_ETAPAS
-- ============================================================
DROP POLICY IF EXISTS "Admins can manage etapas" ON public.projetos_etapas;
CREATE POLICY "etapas_write" ON public.projetos_etapas FOR ALL TO authenticated
USING (public.is_admin_or_director(auth.uid()))
WITH CHECK (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- PROJETO_TAGS
-- ============================================================
DROP POLICY IF EXISTS "Authorized users can manage tags" ON public.projeto_tags;
CREATE POLICY "tags_write" ON public.projeto_tags FOR ALL TO authenticated
USING (public.is_admin_or_director(auth.uid()))
WITH CHECK (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- AGENTE_PROMPTS (broaden select/update to director too)
-- ============================================================
DROP POLICY IF EXISTS "Admins can view agente_prompts" ON public.agente_prompts;
DROP POLICY IF EXISTS "Admins can update agente_prompts" ON public.agente_prompts;

CREATE POLICY "agente_prompts_select" ON public.agente_prompts FOR SELECT TO authenticated
USING (public.is_admin_or_director(auth.uid()));
CREATE POLICY "agente_prompts_write" ON public.agente_prompts FOR ALL TO authenticated
USING (public.is_admin_or_director(auth.uid()))
WITH CHECK (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- ORACULO_KNOWLEDGE: read stays for authenticated (RAG needs it); write admin+director
-- ============================================================
DROP POLICY IF EXISTS "Admins manage knowledge" ON public.oraculo_knowledge;
CREATE POLICY "knowledge_write" ON public.oraculo_knowledge FOR ALL TO authenticated
USING (public.is_admin_or_director(auth.uid()))
WITH CHECK (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- ORACULO_SETTINGS
-- ============================================================
DROP POLICY IF EXISTS "admin all oraculo_settings" ON public.oraculo_settings;
CREATE POLICY "oraculo_settings_all" ON public.oraculo_settings FOR ALL TO authenticated
USING (public.is_admin_or_director(auth.uid()))
WITH CHECK (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- REUNIOES: admin/director all; consultor via own client OR is the consultor
-- ============================================================
DROP POLICY IF EXISTS "Authorized users can view reunioes" ON public.reunioes;
DROP POLICY IF EXISTS "Authorized users can insert reunioes" ON public.reunioes;
DROP POLICY IF EXISTS "Authorized users can update reunioes" ON public.reunioes;
DROP POLICY IF EXISTS "Authorized users can delete reunioes" ON public.reunioes;

CREATE POLICY "reunioes_select" ON public.reunioes FOR SELECT TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR consultor_id = public.get_consultor_id_for_user(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = reunioes.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "reunioes_insert" ON public.reunioes FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR consultor_id = public.get_consultor_id_for_user(auth.uid())
       OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = reunioes.cliente_id
                  AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "reunioes_update" ON public.reunioes FOR UPDATE TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR consultor_id = public.get_consultor_id_for_user(auth.uid()))
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR consultor_id = public.get_consultor_id_for_user(auth.uid()));
CREATE POLICY "reunioes_delete" ON public.reunioes FOR DELETE TO authenticated
USING (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- PROJETOS: broaden delete from admin-only to admin+director
-- ============================================================
DROP POLICY IF EXISTS "Admins can delete projetos" ON public.projetos;
CREATE POLICY "projetos_delete" ON public.projetos FOR DELETE TO authenticated
USING (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- QUESTIONARIOS: broaden delete
-- ============================================================
DROP POLICY IF EXISTS "Admins can delete questionarios" ON public.questionarios;
CREATE POLICY "questionarios_delete" ON public.questionarios FOR DELETE TO authenticated
USING (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- CLIENTE_ARQUIVOS: replace "Admins gerenciam arquivos" with admin+director
-- ============================================================
DROP POLICY IF EXISTS "Admins gerenciam arquivos" ON public.cliente_arquivos;
CREATE POLICY "arquivos_admin_director_all" ON public.cliente_arquivos FOR ALL TO authenticated
USING (public.is_admin_or_director(auth.uid()))
WITH CHECK (public.is_admin_or_director(auth.uid()));

-- ============================================================
-- PROJETO_CHECKLIST: remove "Authorized" delete/update (consultor da carteira já tem via projetos policies)
-- Consultor pode marcar concluído nos projetos da carteira - manter regra via projetos
-- ============================================================
DROP POLICY IF EXISTS "Authorized users can delete projeto_checklist" ON public.projeto_checklist;
DROP POLICY IF EXISTS "Authorized users can update projeto_checklist" ON public.projeto_checklist;
DROP POLICY IF EXISTS "Authorized users can insert projeto_checklist" ON public.projeto_checklist;
DROP POLICY IF EXISTS "Authorized users can view projeto_checklist" ON public.projeto_checklist;

CREATE POLICY "checklist_select" ON public.projeto_checklist FOR SELECT TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_checklist.projeto_id
                  AND p.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "checklist_insert" ON public.projeto_checklist FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_checklist.projeto_id
                  AND p.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "checklist_update" ON public.projeto_checklist FOR UPDATE TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_checklist.projeto_id
                  AND p.consultor_id = public.get_consultor_id_for_user(auth.uid())))
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_checklist.projeto_id
                  AND p.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "checklist_delete" ON public.projeto_checklist FOR DELETE TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_checklist.projeto_id
                  AND p.consultor_id = public.get_consultor_id_for_user(auth.uid())));

-- ============================================================
-- PROJETO_CHECKLIST_RESPONSAVEIS
-- ============================================================
DROP POLICY IF EXISTS "Authorized users can view checklist responsaveis" ON public.projeto_checklist_responsaveis;
DROP POLICY IF EXISTS "Authorized users can insert checklist responsaveis" ON public.projeto_checklist_responsaveis;
DROP POLICY IF EXISTS "Authorized users can update checklist responsaveis" ON public.projeto_checklist_responsaveis;
DROP POLICY IF EXISTS "Authorized users can delete checklist responsaveis" ON public.projeto_checklist_responsaveis;

CREATE POLICY "resp_select" ON public.projeto_checklist_responsaveis FOR SELECT TO authenticated USING (true);
CREATE POLICY "resp_write" ON public.projeto_checklist_responsaveis FOR ALL TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.projeto_checklist ci
                  JOIN public.projetos p ON p.id = ci.projeto_id
                  WHERE ci.id = projeto_checklist_responsaveis.checklist_item_id
                    AND p.consultor_id = public.get_consultor_id_for_user(auth.uid())))
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.projeto_checklist ci
                  JOIN public.projetos p ON p.id = ci.projeto_id
                  WHERE ci.id = projeto_checklist_responsaveis.checklist_item_id
                    AND p.consultor_id = public.get_consultor_id_for_user(auth.uid())));

-- ============================================================
-- PROJETO_DOCUMENTOS
-- ============================================================
DROP POLICY IF EXISTS "Authorized users can view projeto_documentos" ON public.projeto_documentos;
DROP POLICY IF EXISTS "Authorized users can insert projeto_documentos" ON public.projeto_documentos;
DROP POLICY IF EXISTS "Authorized users can update projeto_documentos" ON public.projeto_documentos;
DROP POLICY IF EXISTS "Authorized users can delete projeto_documentos" ON public.projeto_documentos;

CREATE POLICY "docs_select" ON public.projeto_documentos FOR SELECT TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_documentos.projeto_id
                  AND p.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "docs_insert" ON public.projeto_documentos FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_documentos.projeto_id
                  AND p.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "docs_update" ON public.projeto_documentos FOR UPDATE TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_documentos.projeto_id
                  AND p.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "docs_delete" ON public.projeto_documentos FOR DELETE TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_documentos.projeto_id
                  AND p.consultor_id = public.get_consultor_id_for_user(auth.uid())));

-- ============================================================
-- PROJETO_COMENTARIOS
-- ============================================================
DROP POLICY IF EXISTS "Authorized users can view projeto_comentarios" ON public.projeto_comentarios;
DROP POLICY IF EXISTS "Authorized users can insert projeto_comentarios" ON public.projeto_comentarios;
DROP POLICY IF EXISTS "Authorized users can delete projeto_comentarios" ON public.projeto_comentarios;

CREATE POLICY "coment_select" ON public.projeto_comentarios FOR SELECT TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_comentarios.projeto_id
                  AND p.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "coment_insert" ON public.projeto_comentarios FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_comentarios.projeto_id
                  AND p.consultor_id = public.get_consultor_id_for_user(auth.uid()))));
CREATE POLICY "coment_delete" ON public.projeto_comentarios FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_admin_or_director(auth.uid()));

-- ============================================================
-- PROJETO_TAG_VINCULO
-- ============================================================
DROP POLICY IF EXISTS "Authorized can manage tag links" ON public.projeto_tag_vinculo;
DROP POLICY IF EXISTS "Authorized can delete tag links" ON public.projeto_tag_vinculo;

CREATE POLICY "tagvinc_insert" ON public.projeto_tag_vinculo FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_tag_vinculo.projeto_id
                  AND p.consultor_id = public.get_consultor_id_for_user(auth.uid())));
CREATE POLICY "tagvinc_delete" ON public.projeto_tag_vinculo FOR DELETE TO authenticated
USING (public.is_admin_or_director(auth.uid())
       OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_tag_vinculo.projeto_id
                  AND p.consultor_id = public.get_consultor_id_for_user(auth.uid())));
