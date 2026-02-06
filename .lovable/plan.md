

## Corrigir Atualização do Dashboard e Adicionar Gráfico de Contratos

### Problema Identificado

O dashboard não está sendo atualizado automaticamente após inclusão de novos clientes porque os hooks `useCreateCliente`, `useUpdateCliente`, `useCreateOnboarding` e `useUpdateOnboarding` **não invalidam as queries do dashboard**.

Enquanto hooks como `useContratos` e `useEncerramentos` chamam:
```typescript
queryClient.invalidateQueries({ queryKey: ['dashboard'] });
```

Os hooks de clientes e onboarding não fazem isso, causando dados desatualizados.

### Alterações Planejadas

---

#### 1. Corrigir invalidação de cache em `useClientes.ts`

Adicionar invalidação do dashboard em:
- `useCreateCliente` 
- `useUpdateCliente`
- `useDeleteCliente` (já invalidava, mas verificar consistência)

Antes:
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['clientes'] });
}
```

Depois:
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['clientes'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
}
```

---

#### 2. Corrigir invalidação de cache em `useOnboarding.ts`

Adicionar invalidação do dashboard em:
- `useCreateOnboarding`
- `useUpdateOnboarding`

---

#### 3. Criar novo hook `useContratosHistorico` em `useDashboard.ts`

Novo hook para buscar dados dos contratos novos e encerrados nos últimos 12 meses:

```typescript
export function useContratosHistorico() {
  return useQuery({
    queryKey: ['dashboard', 'contratos-historico'],
    queryFn: async () => {
      // Buscar contratos (data_inicio para novos)
      // Buscar encerramentos (data_encerramento para rescindidos)
      // Agrupar por mês nos últimos 12 meses
      // Retornar: { mes: string, novos: number, encerrados: number }[]
    }
  });
}
```

---

#### 4. Adicionar gráfico de barras em `Dashboard.tsx`

Novo card abaixo do gráfico de MRR Histórico com:
- Título: "Contratos Novos vs. Encerrados (últimos 12 meses)"
- Gráfico de barras com duas séries:
  - **Novos** (cor verde/primária)
  - **Encerrados** (cor vermelha/destrutiva)
- Usar `BarChart` do Recharts (já instalado)

---

### Arquivos a Editar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useClientes.ts` | Adicionar invalidação do dashboard em `useCreateCliente` e `useUpdateCliente` |
| `src/hooks/useOnboarding.ts` | Adicionar invalidação do dashboard em `useCreateOnboarding` e `useUpdateOnboarding` |
| `src/hooks/useDashboard.ts` | Adicionar novo hook `useContratosHistorico` |
| `src/pages/Dashboard.tsx` | Adicionar gráfico de barras e importar o novo hook |

---

### Detalhes Técnicos

```text
FLUXO ATUAL (PROBLEMA)
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Criar       │────▶│ invalidate   │     │   Dashboard   │
│ Cliente     │     │ ['clientes'] │     │   (stale)     │
└─────────────┘     └──────────────┘     └───────────────┘
                          │
                          ▼
                    Dashboard NÃO
                    é atualizado

FLUXO CORRIGIDO
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Criar       │────▶│ invalidate   │────▶│   Dashboard   │
│ Cliente     │     │ ['clientes'] │     │   (refetch)   │
└─────────────┘     │ ['dashboard']│     └───────────────┘
                    └──────────────┘
```

**Estrutura do novo gráfico:**

```text
┌─────────────────────────────────────────────────────────┐
│  Contratos Novos vs. Encerrados (últimos 12 meses)      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   5 │    ██                                             │
│   4 │    ██  ██      ██                                 │
│   3 │ ██ ██  ██  ██  ██  ██      ██  ██                 │
│   2 │ ██ ██  ██  ██  ██  ██  ▒▒  ██  ██  ██  ██        │
│   1 │ ██ ▒▒  ██  ▒▒  ██  ▒▒  ▒▒  ██  ▒▒  ██  ▒▒  ██   │
│   0 └────────────────────────────────────────────────   │
│     jan fev mar abr mai jun jul ago set out nov dez    │
│                                                          │
│     ██ Novos    ▒▒ Encerrados                           │
└─────────────────────────────────────────────────────────┘
```

