

## Multi-seleção de Consultores no Dashboard

### Objetivo
Substituir o seletor único de consultor por um componente que permite selecionar múltiplos consultores simultaneamente, mantendo a opção "Todos" e exibindo badges com os consultores selecionados.

### Abordagem de UI

A melhor experiência para este caso é usar um **Popover com checkboxes**, onde:
- Cada consultor tem um checkbox
- Os selecionados aparecem como badges no botão
- O botão mostra "Todos os consultores" quando nenhum está selecionado

```text
┌─────────────────────────────────────────────┐
│  [✓] João Silva  [✓] Maria Santos  [X]     │  <- Badges dos selecionados
│  ▼                                          │
└─────────────────────────────────────────────┘
         │
         ▼  (popover aberto)
┌─────────────────────────────────────────────┐
│  [ ] Todos os consultores                   │
│  [✓] João Silva                             │
│  [✓] Maria Santos                           │
│  [ ] Pedro Oliveira                         │
│  [ ] Ana Costa                              │
└─────────────────────────────────────────────┘
```

---

### Alterações Necessárias

#### 1. Dashboard - Estado e UI (src/pages/Dashboard.tsx)

**Mudança de estado:**
```typescript
// DE:
const [consultorFiltro, setConsultorFiltro] = useState<string>('todos');
const consultorIdFiltro = consultorFiltro !== 'todos' ? consultorFiltro : undefined;

// PARA:
const [consultoresSelecionados, setConsultoresSelecionados] = useState<string[]>([]);
const consultorIdsFiltro = consultoresSelecionados.length > 0 ? consultoresSelecionados : undefined;
```

**Substituir o Select por Popover com checkboxes:**
- Importar `Popover`, `PopoverTrigger`, `PopoverContent`, `Checkbox`
- Listar consultores com checkboxes
- Mostrar badges dos selecionados no trigger
- Opção para limpar seleção ("Todos")

---

#### 2. Hooks - Suporte a Array de IDs

Todos os hooks do dashboard precisam ser atualizados para aceitar `consultorIds?: string[]` ao invés de `consultorId?: string`:

| Hook | Arquivo |
|------|---------|
| `useClientesAtivos` | useClientes.ts |
| `useClientesAguardandoRenovacao` | useClientes.ts |
| `useListaClientesAtivos` | useClientes.ts |
| `useListaClientesAguardandoRenovacao` | useClientes.ts |
| `useMRRTotal` | useContratos.ts |
| `useListaContratosMRR` | useContratos.ts |
| `useChurnDoMes` | useEncerramentos.ts |
| `useListaChurnMes` | useEncerramentos.ts |
| `useAlertas` | useDashboard.ts |
| `useMRRHistorico` | useDashboard.ts |
| `useContratosHistorico` | useDashboard.ts |

**Padrão de modificação:**

```typescript
// DE:
export function useClientesAtivos(consultorId?: string) {
  // ...
  if (consultorId) {
    query = query.eq('consultor_id', consultorId);
  }
}

// PARA:
export function useClientesAtivos(consultorIds?: string[]) {
  // ...
  if (consultorIds && consultorIds.length > 0) {
    query = query.in('consultor_id', consultorIds);
  }
}
```

Para hooks que filtram no JavaScript (após a query):
```typescript
// DE:
.filter(c => !consultorId || c.cliente?.consultor_id === consultorId)

// PARA:
.filter(c => !consultorIds?.length || consultorIds.includes(c.cliente?.consultor_id))
```

---

#### 3. Modais - Atualizar indicador de filtro

Nos modais, onde antes aparecia "Filtrado por consultor", agora mostrará quantos consultores estão selecionados:

```tsx
// DE:
{consultorFiltro !== 'todos' && (
  <Badge variant="outline">Filtrado por consultor</Badge>
)}

// PARA:
{consultoresSelecionados.length > 0 && (
  <Badge variant="outline">
    {consultoresSelecionados.length} consultor(es) selecionado(s)
  </Badge>
)}
```

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Dashboard.tsx` | Substituir Select por Popover multi-select, atualizar estado e chamadas dos hooks |
| `src/hooks/useClientes.ts` | Atualizar 4 hooks para aceitar array de IDs |
| `src/hooks/useContratos.ts` | Atualizar 2 hooks para aceitar array de IDs |
| `src/hooks/useEncerramentos.ts` | Atualizar 2 hooks para aceitar array de IDs |
| `src/hooks/useDashboard.ts` | Atualizar 3 hooks para aceitar array de IDs |

---

### Fluxo de Uso

```text
1. Usuário abre Dashboard
   └── Seletor mostra "Todos os consultores"

2. Clica no seletor
   └── Popover abre com lista de checkboxes

3. Marca "João Silva" e "Maria Santos"
   └── Popover fecha
   └── Botão mostra badges: [João Silva] [Maria Santos] [X]
   └── Dashboard filtra dados para ambos consultores

4. Clica no [X] ou seleciona "Todos"
   └── Limpa seleção
   └── Dashboard mostra dados de todos
```

---

### Resultado Esperado

- Usuario pode selecionar um, varios ou todos os consultores
- Badges mostram quem está selecionado
- Todos os KPIs, graficos e modais respeitam a multi-seleção
- Performance mantida usando `.in()` do Supabase ao inves de multiplas queries

