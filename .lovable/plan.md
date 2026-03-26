

## Avaliacao de Engajamento do Cliente + Grafico no Dashboard

### Conceito

A avaliacao do cliente fica separada da do consultor. Na pagina de detalhe do cliente (`/clientes/:id`), uma nova aba "Desempenho" mostra as reunioes do cliente com scores de engajamento, no mesmo formato visual usado para o consultor. No Dashboard, um grafico de barras horizontais mostra ranking de clientes por engajamento.

### Alteracoes

#### 1. Banco de dados (migracao)
- Adicionar `score_cliente` (numeric, nullable) e `analise_cliente` (jsonb, nullable) na tabela `reunioes`

#### 2. Edge function `analisar-reuniao/index.ts`
- Apos a analise do consultor, fazer uma segunda chamada de IA com prompt focado no cliente
- 5 criterios: Participacao Ativa, Abertura a Sugestoes, Comprometimento com Acoes, Clareza nas Demandas, Engajamento Estrategico
- Salvar em `score_cliente` e `analise_cliente` (mesmo formato: criterios + pontos fortes/melhoria + resumo)

#### 3. Nova aba "Desempenho" na pagina do cliente
**`src/components/cliente/DesempenhoClienteTab.tsx`** (novo)
- Recebe `clienteId` como prop
- Busca reunioes do cliente que tenham `analise_cliente` preenchida
- Exibe: score medio de engajamento, lista de reunioes com notas por criterio, pontos fortes e de melhoria
- Formato visual similar ao `ReuniaoAnalise.tsx` (barras de progresso, badges)

**`src/pages/ClienteDetalhe.tsx`**
- Adicionar quinta aba "Desempenho" com icone BarChart3

#### 4. Relatorio PDF do cliente
**`src/pages/RelatorioCliente.tsx`** (novo)
- Mesmo design system Cupola (Barlow Condensed, paleta cupola) usado no relatorio do consultor
- Secoes: header, score hero, media por criterio, evolucao do score, cards de reuniao com analise do cliente
- Botao "Gerar Relatorio" na aba Desempenho

**`src/App.tsx`**
- Adicionar rota `/clientes/:id/relatorio`

#### 5. Grafico de engajamento no Dashboard
**`src/hooks/useDashboard.ts`**
- Novo hook `useEngajamentoClientes` que busca reunioes com `score_cliente` nao nulo, agrupa por cliente e calcula media

**`src/pages/Dashboard.tsx`**
- Novo card "Engajamento dos Clientes" com grafico de barras horizontais (Recharts)
- Barras ordenadas do mais engajado ao menos engajado
- Cores: verde para score >= 8, amarelo >= 6, vermelho < 6
- Mostra nome do cliente + score medio

#### 6. Tipos
**`src/hooks/useReunioes.ts`**
- Adicionar `score_cliente` e `analise_cliente` ao tipo `Reuniao`

### Arquivos

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Adicionar `score_cliente`, `analise_cliente` em reunioes |
| `supabase/functions/analisar-reuniao/index.ts` | Segunda chamada de IA para cliente |
| `src/components/cliente/DesempenhoClienteTab.tsx` | Criar -- aba de desempenho |
| `src/pages/ClienteDetalhe.tsx` | Adicionar aba Desempenho |
| `src/pages/RelatorioCliente.tsx` | Criar -- relatorio PDF do cliente |
| `src/App.tsx` | Rota `/clientes/:id/relatorio` |
| `src/hooks/useReunioes.ts` | Atualizar tipos |
| `src/hooks/useDashboard.ts` | Hook `useEngajamentoClientes` |
| `src/pages/Dashboard.tsx` | Grafico de engajamento |

