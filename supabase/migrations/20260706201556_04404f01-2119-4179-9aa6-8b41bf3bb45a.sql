ALTER TABLE public.agente_prompts
  ADD COLUMN IF NOT EXISTS template_sheets_id text;

ALTER TABLE public.projeto_documentos
  ADD COLUMN IF NOT EXISTS dados_estruturados jsonb,
  ADD COLUMN IF NOT EXISTS sheet_url text;

UPDATE public.agente_prompts
SET prompt = prompt || E'\n\nREGRAS DO PLANO:\n- Gere NO MÁXIMO 2 objetivos. Isso é uma decisão metodológica: o plano trimestral exige foco e priorização. Se o diagnóstico aponta mais frentes, escolha as 2 de maior impacto e mencione as demais na seção de observações do documento como candidatas a ciclos futuros.\n- Cada objetivo tem no máximo 4 Key Results.\n- Cada KR tem entre 3 e 6 ações concretas e executáveis. As ações descrevem O QUE fazer; a medição está no KR.\n- Cada KR deve ser mensurável, com baseline e meta explícitos no texto (ex: "Aumentar a média mensal de agenciamentos por corretor de 4 para 6").\n- Prefira menos KRs bem construídos a mais KRs vagos. Objetividade e praticidade acima de abrangência.\n\nAo final da resposta, inclua um bloco JSON estruturado delimitado por <OKRS_JSON></OKRS_JSON> exatamente neste formato (sem markdown, sem comentários):\n<OKRS_JSON>\n{\n  "trimestre": "Q3 2026",\n  "objetivos": [\n    {\n      "objetivo": "texto do objetivo",\n      "key_results": [\n        {\n          "kr": "descrição mensurável com baseline e meta",\n          "acoes": ["ação 1", "ação 2", "ação 3"],\n          "observacoes": "nota opcional"\n        }\n      ]\n    }\n  ]\n}\n</OKRS_JSON>',
    updated_at = now()
WHERE tipo = 'okrs'
  AND prompt NOT ILIKE '%REGRAS DO PLANO%';