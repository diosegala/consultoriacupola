

## Renomear "Score IA" para "Score" e exibir score medio

### Problema
A coluna "Score IA" na tabela de consultores exibe apenas "—" fixo (hardcoded). Ja existem reunioes analisadas com `score_ia` no banco, mas o `useConsultoresComStats` nao busca esses dados.

### Alteracoes

**`src/pages/Consultores.tsx`**
- Linha 183: renomear "Score IA" para "Score"
- Linha 202: substituir o "—" fixo pelo score medio do consultor, formatado com 1 casa decimal. Se nao houver reunioes analisadas, manter "—"

**`src/hooks/useConsultores.ts`**
- No `useConsultoresComStats`, alem de buscar clientes, buscar tambem reunioes com `status_analise = 'concluido'` e `score_ia not null`
- Calcular a media de `score_ia` por `consultor_id`
- Adicionar `score_medio: number | null` ao tipo `ConsultorComStats`

Nenhuma alteracao de banco necessaria.

