---
name: Regras dos alertas do Meu Painel
description: Janela de silêncio dos alertas proativos, exclusão de clientes/projetos encerrados e critério do alerta de sentimento negativo
type: feature
---
Dedup dos alertas de `gerar-alertas-proativos` usa **janela de silêncio por tipo + entidade**, contando também notificações já lidas (marcar como resolvida não pode fazer o alerta voltar no dia seguinte):
sem_contato/checklist_parado/okr_sem_progresso/compromisso_vencido/score_cliente_em_queda = 14d; contrato_sem_renovacao = 21d; lembrete_gestao/briefing_1x1 = 7d; briefing_pre_reuniao = 5d; sentimento_negativo_cliente = nunca repete para a mesma reunião.

Nenhum alerta deve considerar clientes com `arquivado_em` ou status `encerrado`, projetos com `arquivado_em`, nem contratos inativos/`encerrado_em`.

Alerta de sentimento negativo (`analisar-reuniao`): só notifica quando o desconforto é **direcionado à consultoria** (valor/ROI, metodologia, consultora, cancelar/renegociar contrato, comparação com concorrente). Reclamações sobre mercado, equipe interna, corretores, sistemas ou momento pessoal são classificadas como `negocio_do_cliente` e ficam apenas na análise. Cada alerta tem `alvo` e `confianca` (alta >= 0,5; média >= 0,7).
