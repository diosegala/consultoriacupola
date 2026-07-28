---
name: Risco de churn por engajamento
description: Regras do bloco "Risco de churn" no Meu Painel e do alerta score_cliente_em_queda
type: feature
---
Deriva de `reunioes.score_cliente` (sem tabela nova), janela de 180 dias, mínimo 2 reuniões analisadas.

- Crítico: última reunião < 6,0 OU média das 3 últimas < 6,5.
- Atenção: queda >= 1,5 entre média das 3 últimas e das 3 anteriores, ou 3 reuniões seguidas em queda.
- Contrato vencendo em até 90 dias eleva a severidade para crítico.

Lógica pura em `src/lib/riscoEngajamento.ts` (replicada na edge function `gerar-alertas-proativos`).
Notificação `score_cliente_em_queda` vai para diretores/admins + consultora responsável, dedup de 14 dias por cliente.
