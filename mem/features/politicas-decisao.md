---
name: Políticas de decisão editáveis
description: Tabela politicas_decisao guarda limiares configuráveis (ex.: risco_churn) usados por frontend e edge functions
type: feature
---
Tabela `politicas_decisao` (tipo, parametros jsonb, ativo, versao, atualizado_por/em). Leitura para authenticated; escrita só admin/director.

- `risco_churn`: { score_critico, media_critica, queda_minima, min_reunioes, janela_dias, contrato_vence_em_dias }.
- Frontend: hook `usePoliticasDecisao.ts` + `avaliarRiscoEngajamento(reunioes, parametros, opts)`; default em `PARAMETROS_RISCO_CHURN_DEFAULT`.
- Edge function `gerar-alertas-proativos` lê a política no início do bloco de score em queda.
- UI de edição: aba "Políticas" em Configurações (admin/director).
