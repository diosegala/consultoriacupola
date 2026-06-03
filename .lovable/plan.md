## Objetivo

Quando um contrato for encerrado como **fim_contrato**, ele deve continuar compondo o MRR até a data em que a última parcela for efetivamente paga — não sair imediatamente como hoje. Encerramentos por **churn** mantêm o comportamento atual (saída imediata).

## Mudanças no banco

Adicionar coluna em `contratos`:
- `data_fim_pagamento` (DATE, nullable): data até a qual o contrato ainda gera receita. Quando nula, usa `data_fim` (comportamento atual).

Calculada automaticamente como:
- `tipo_vencimento = 'antecipado'`: `data_inicio + (parcelas - 1) meses`
- `tipo_vencimento = 'postecipado'`: `data_inicio + parcelas meses`

Backfill: preencher `data_fim_pagamento` em contratos existentes a partir de `data_inicio`, `parcelas` e `tipo_vencimento`.

## Mudanças na lógica de encerramento (`useEncerrarContrato`)

Quando `classificacao = 'fim_contrato'`:
1. Calcular a data da última parcela.
2. Se `data_última_parcela > hoje`: **não desativar** o contrato ainda. Apenas registrar o `encerramento` e marcar um flag/campo (`encerrado_em` em `contratos`) para indicar que está em "rabicho financeiro".
3. Se já passou: comportamento atual (desativar imediatamente).

Status do cliente vai para `encerrado` somente quando o contrato realmente sair do MRR (sem outros contratos ativos).

Para churn: mantém fluxo atual (desativa e zera MRR na hora).

## Job de baixa automática

Edge function agendada diária (`encerrar-contratos-pagos`) que:
- Busca contratos com `encerrado_em IS NOT NULL` e `data_fim_pagamento <= hoje` ainda com `ativo = true`.
- Marca `ativo = false` e atualiza status do cliente se for o caso.

## Mudanças nas queries de MRR

`useMRRTotal` e `useListaContratosMRR` (em `useContratos.ts`) continuam filtrando `ativo = true` — como a desativação real é adiada, o MRR permanece correto sem mudar a query. Adicionar apenas filtro defensivo: ignorar contratos cuja `data_fim_pagamento < hoje`.

## UI

- Em `ContratoTab` e `Contratos.tsx`: mostrar badge "Encerrado — aguardando última parcela em DD/MM/AAAA" para contratos nesse estado intermediário.
- No diálogo de encerramento: ao escolher "fim_contrato", exibir aviso: "Este contrato continuará no MRR até DD/MM/AAAA (última parcela)."

## Arquivos afetados

- nova migration: coluna `data_fim_pagamento` + `encerrado_em` + backfill
- `src/hooks/useEncerramentos.ts`: lógica condicional
- `src/hooks/useContratos.ts`: filtro defensivo + tipos
- `src/components/cliente/ContratoTab.tsx` e diálogo de encerramento: aviso + badge
- `src/pages/Contratos.tsx`: badge na listagem
- nova edge function `encerrar-contratos-pagos` + agendamento em `supabase/config.toml`

## Memória

Atualizar `mem://features/financial-monitoring` com a regra: "MRR de contratos com fim_contrato persiste até a última parcela (data_fim_pagamento). Churn zera imediatamente."
