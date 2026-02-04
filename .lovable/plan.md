

# Plano: Cards de KPI com Modal Dedicado

## Objetivo
Ao clicar nos cards de KPI (Ativos, Vencendo 30d, Vencidos), abrir um modal dedicado mostrando apenas os contratos daquele status, sem alterar a lista principal ou os números dos KPIs.

---

## Problemas Identificados

1. **KPIs mudam ao filtrar**: Os números são calculados com base nos dados já filtrados, então quando você aplica um filtro, os números mudam
2. **Comportamento não ideal**: Filtrar a lista abaixo não é intuitivo - o usuário espera ver uma lista dedicada em um modal

---

## Solução

### 1. Buscar dados separados para KPIs

Criar uma query separada que busca TODOS os contratos ativos (sem filtros) apenas para calcular os KPIs, garantindo que os números sejam sempre fixos.

### 2. Modal com lista de contratos

Ao clicar em um card, abrir um modal que exibe a lista de contratos daquele status específico, permitindo clicar em cada contrato para ver detalhes.

---

## Modificações no arquivo `src/pages/Contratos.tsx`

### A) Novos estados

```typescript
// Modal para lista de contratos por status
const [cardModalType, setCardModalType] = useState<'ativos' | 'vencendo' | 'vencidos' | null>(null);
```

### B) Query separada para KPIs (sem filtros)

```typescript
// Buscar TODOS os contratos ativos para KPIs (sem filtros)
const { data: todosContratosAtivos } = useAllContratos({ ativo: true });

// Calcular KPIs com base nos dados sem filtro
const kpis = useMemo(() => {
  if (!todosContratosAtivos) return { ativos: 0, vencendo30: 0, vencidos: 0, mrrTotal: 0 };
  // ... cálculo usando todosContratosAtivos
}, [todosContratosAtivos]);
```

### C) Listas filtradas para o modal

```typescript
// Contratos para exibir no modal (calculados a partir dos dados sem filtro)
const contratosModal = useMemo(() => {
  if (!todosContratosAtivos || !cardModalType) return [];
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch (cardModalType) {
    case 'ativos':
      return todosContratosAtivos; // Todos os ativos
    case 'vencendo':
      return todosContratosAtivos.filter(c => {
        const dataFim = new Date(c.data_fim);
        const dias = differenceInDays(dataFim, today);
        return dias >= 0 && dias <= 30;
      });
    case 'vencidos':
      return todosContratosAtivos.filter(c => {
        const dataFim = new Date(c.data_fim);
        return dataFim < today;
      });
  }
}, [todosContratosAtivos, cardModalType]);
```

### D) Remover lógica de filtro dos cards

Os cards não vão mais alterar os filtros da lista principal. Apenas abrem o modal:

```typescript
const handleCardClick = (type: 'ativos' | 'vencendo' | 'vencidos') => {
  setCardModalType(type);
};
```

### E) Novo Modal com lista de contratos

Adicionar um Dialog que exibe a lista de contratos do status selecionado:

```text
+--------------------------------------------------+
|  Contratos Vencendo (30d)              [X]       |
+--------------------------------------------------+
|                                                  |
|  +--------------------------------------------+  |
|  | Cliente ABC          | Vence: 15/02/2026  |  |
|  | Tipo: Consultoria X  | MRR: R$ 5.000      |  |
|  +--------------------------------------------+  |
|                                                  |
|  +--------------------------------------------+  |
|  | Cliente XYZ          | Vence: 20/02/2026  |  |
|  | Tipo: Consultoria Y  | MRR: R$ 3.500      |  |
|  +--------------------------------------------+  |
|                                                  |
+--------------------------------------------------+
```

Cada item da lista será clicável para abrir os detalhes do contrato (reaproveitando o modal de detalhes já existente).

---

## Comportamento Final

| Ação | Resultado |
|------|-----------|
| Clica em "Ativos" | Abre modal com lista de todos os contratos ativos |
| Clica em "Vencendo (30d)" | Abre modal com contratos vencendo nos próximos 30 dias |
| Clica em "Vencidos" | Abre modal com contratos já vencidos |
| Clica em um contrato no modal | Abre os detalhes daquele contrato |
| Altera filtros na página | KPIs permanecem inalterados |

---

## Resumo das Mudanças

1. Adicionar query separada para buscar todos os contratos ativos (para KPIs)
2. Calcular KPIs com base nessa query fixa (sem filtros)
3. Remover estado `activeCardFilter` e lógica de filtro nos cards
4. Adicionar estado `cardModalType` para controlar qual modal está aberto
5. Criar novo Dialog com lista de contratos por status
6. Cards ficam clicáveis apenas para abrir o modal correspondente
7. Lista principal e seus filtros continuam funcionando independentemente

---

## Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/Contratos.tsx` | Implementar modal de lista por status e query separada para KPIs |

