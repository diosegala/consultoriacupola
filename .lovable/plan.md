

## Card de Media de Despesas com Viagens + Grafico Mensal

### O que sera feito

1. **Novo KPI Card** - Adicionar um quinto card no Dashboard mostrando a media das despesas com viagens (total de despesas dividido pelo numero de contratos que possuem viagens lancadas).

2. **Novo Grafico de Barras** - Adicionar um grafico de barras como ultimo grafico do Dashboard, mostrando o total de despesas com viagens por mes (ultimos 12 meses).

---

### Detalhes

#### KPI Card - Media de Despesas com Viagens
- Posicionado junto aos outros 4 cards existentes (a grid passara a ter 5 cards, distribuidos em 2 linhas no desktop)
- Mostra o valor medio de despesas por contrato (soma total / quantidade de contratos com viagens)
- Icone de aviao ou mapa para representar viagens
- Se nao houver viagens lancadas, mostra R$ 0

#### Grafico de Barras - Despesas com Viagens por Mes
- Ultimo grafico do Dashboard (abaixo do grafico de Contratos Novos vs Encerrados e acima da tabela de Alertas)
- Barras mostrando o total de despesas com viagens em cada mes dos ultimos 12 meses
- Segue o mesmo padrao visual dos outros graficos (cores, tooltips, responsividade)

---

### Secao Tecnica

#### Novo hook em `src/hooks/useDashboard.ts`

Adicionar duas funcoes:

1. **`useMediaDespesasViagens(consultorIds?)`** - Busca todas as viagens com o consultor_id do cliente, calcula a media por contrato
2. **`useDespesasViagensMensal(consultorIds?)`** - Agrupa viagens por mes (usando `data_viagem`), retorna array com `{ mes, total }` para os ultimos 12 meses

Ambas consultam a tabela `viagens_contrato` com join em `clientes` para filtrar por consultor.

#### Alteracoes em `src/pages/Dashboard.tsx`

| Alteracao | Detalhe |
|-----------|---------|
| Importar novos hooks | `useMediaDespesasViagens` e `useDespesasViagensMensal` |
| Novo KPI card | Card com icone Plane, mostrando media formatada como moeda |
| Novo grafico | `BarChart` do Recharts com barras de despesas por mes |
| Grid dos cards | Ajustar grid para acomodar 5 cards (manter `lg:grid-cols-4` ou mudar para `lg:grid-cols-5`) |

#### Estrutura dos dados

```text
useMediaDespesasViagens -> numero (media em R$)

useDespesasViagensMensal -> [
  { mes: "mar/25", total: 2500 },
  { mes: "abr/25", total: 1800 },
  ...
]
```

### Arquivos a modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useDashboard.ts` | Adicionar `useMediaDespesasViagens` e `useDespesasViagensMensal` |
| `src/pages/Dashboard.tsx` | Adicionar KPI card de viagens + grafico de barras mensal |

