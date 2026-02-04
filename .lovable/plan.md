
# Plano: Cards de KPI Clicáveis na Página de Contratos

## Objetivo
Transformar os cards de resumo (Ativos, Vencendo 30d, Vencidos) em elementos clicáveis que, ao serem acionados, aplicam automaticamente o filtro correspondente na lista de contratos abaixo.

---

## Situação Atual

Os cards exibem as seguintes métricas:
- **Ativos**: Total de contratos com status ativo
- **Vencendo (30d)**: Contratos ativos que vencem nos próximos 30 dias
- **Vencidos**: Contratos ativos com data de fim já ultrapassada
- **MRR Total**: Soma da remuneração mensal (não será clicável)

Os filtros já existem na página e suportam:
- Status (ativo/inativo)
- Vencimento (30d, 60d, 90d, vencidos)

---

## Implementação

### Modificações no arquivo `src/pages/Contratos.tsx`

1. **Adicionar estado para rastrear card selecionado**
   - Novo estado: `activeCardFilter` com valores possíveis: `'all' | 'ativos' | 'vencendo' | 'vencidos'`

2. **Criar função de clique para cada card**
   - Ao clicar em "Ativos": aplica filtro `ativo: true, vencimento: 'all'`
   - Ao clicar em "Vencendo (30d)": aplica filtro `ativo: true, vencimento: '30'`
   - Ao clicar em "Vencidos": aplica filtro `ativo: true, vencimento: 'vencidos'`
   - Clicar novamente no card ativo: remove o filtro (volta ao padrão)

3. **Estilização visual dos cards**
   - Card selecionado: borda destacada com cor correspondente
   - Cursor pointer para indicar interatividade
   - Transição suave ao passar o mouse
   - Card MRR Total permanece sem interação (apenas informativo)

4. **Sincronização com filtros existentes**
   - Atualizar o `activeCardFilter` quando filtros manuais coincidirem
   - Limpar seleção do card quando filtros forem alterados manualmente para valores diferentes

---

## Comportamento Esperado

| Ação do Usuário | Resultado |
|-----------------|-----------|
| Clica em "Ativos" | Lista mostra apenas contratos ativos, card fica destacado |
| Clica em "Vencendo (30d)" | Lista mostra contratos vencendo em 30 dias, card fica destacado |
| Clica em "Vencidos" | Lista mostra contratos vencidos, card fica destacado |
| Clica no card já selecionado | Remove o filtro, volta ao estado padrão |
| Altera filtros manualmente | Card perde destaque se filtro não corresponder |
| Clica em "Limpar filtros" | Remove seleção do card |

---

## Detalhes Visuais

```text
+------------------+  +------------------+  +------------------+  +------------------+
|     Ativos       |  |  Vencendo (30d)  |  |     Vencidos     |  |    MRR Total     |
|       12         |  |        3         |  |        2         |  |   R$ 45.000,00   |
|  [clicável]      |  |   [clicável]     |  |   [clicável]     |  |  [informativo]   |
+------------------+  +------------------+  +------------------+  +------------------+
        |                    |                     |
        v                    v                     v
   Borda verde          Borda amarela         Borda vermelha
   quando ativo         quando ativo          quando ativo
```

---

## Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/Contratos.tsx` | Adicionar interatividade aos cards de KPI |

---

## Resumo das Ações

1. Adicionar estado `activeCardFilter` para rastrear qual card está selecionado
2. Criar função `handleCardClick` que aplica os filtros correspondentes
3. Tornar os cards de Ativos, Vencendo e Vencidos clicáveis com `onClick`
4. Adicionar estilos visuais para indicar card selecionado (borda, hover, cursor)
5. Sincronizar seleção do card com alterações manuais nos filtros
6. Manter card MRR Total como apenas informativo (sem clique)
