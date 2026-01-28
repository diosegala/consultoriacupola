
# Plano: Nova Página de Contratos

## Contexto

Você está correto! A estrutura atual mostra contratos apenas dentro da página de cada cliente, mas uma visão consolidada de todos os contratos facilita:

- Ver todos os contratos que vencem em breve (independente do cliente)
- Filtrar por status (ativos/inativos)
- Analisar histórico completo de renovações
- Identificar rapidamente contratos que precisam de ação

## Arquitetura Proposta

```text
+------------------+       +-------------------+
|   /clientes      |       |    /contratos     |
|------------------|       |-------------------|
| Lista de         |       | Lista de TODOS    |
| CLIENTES com     |       | CONTRATOS com     |
| contrato ativo   |       | filtros por:      |
| resumido         |       | - Status (ativo/  |
|                  |       |   inativo)        |
| Click -> Detalhe |       | - Cliente         |
+------------------+       | - Consultor       |
                           | - Vencimento      |
                           |                   |
                           | Click -> Detalhe  |
                           | do Cliente        |
                           +-------------------+
```

---

## Funcionalidades da Nova Página

### Filtros Disponíveis
- **Status**: Ativos, Inativos, Todos
- **Cliente**: Busca por nome
- **Consultor**: Dropdown
- **Tipo de Consultoria**: Dropdown
- **Vencimento**: Próximos 30/60/90 dias, Vencidos

### Colunas da Tabela
| Cliente | Tipo | Início | Fim | MRR | Status | Ações |
|---------|------|--------|-----|-----|--------|-------|

### Ações por Contrato
- **Ver Cliente**: Navega para `/clientes/:id`
- **Editar**: Abre form de edição (apenas contratos ativos)
- **Renovar**: Abre form de renovação (apenas contratos ativos)
- **Encerrar**: Abre form de encerramento (apenas contratos ativos)

---

## Implementação Técnica

### Etapa 1: Novo Hook para Listar Todos os Contratos

Criar `useAllContratos` em `src/hooks/useContratos.ts`:

```typescript
export function useAllContratos(filters?: {
  ativo?: boolean;
  consultor_id?: string;
  tipo_consultoria_id?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['all-contratos', filters],
    queryFn: async () => {
      let query = supabase
        .from('contratos')
        .select(`
          *,
          tipo_consultoria:tipos_consultoria(*),
          cliente:clientes!contratos_cliente_id_fkey(
            id, nome, cidade, uf, status,
            consultor:consultores(id, nome)
          )
        `)
        .order('data_fim', { ascending: true });

      if (filters?.ativo !== undefined) {
        query = query.eq('ativo', filters.ativo);
      }
      // ... outros filtros

      return data;
    }
  });
}
```

### Etapa 2: Nova Página de Contratos

Criar `src/pages/Contratos.tsx` com:
- Filtros por status, cliente, consultor, tipo, vencimento
- Tabela com todos os contratos
- Badges coloridos para status (Ativo = verde, Inativo = cinza)
- Destaque para contratos vencendo em breve (amarelo)
- Destaque para contratos vencidos (vermelho)

### Etapa 3: Atualizar Navegação

Adicionar item no Sidebar (`src/components/layout/Sidebar.tsx`):
```typescript
{ to: '/contratos', icon: FileText, label: 'Contratos' },
```

Adicionar rota em `src/App.tsx`:
```typescript
<Route path="/contratos" element={<Contratos />} />
```

---

## Interface Visual

### Cards de Resumo (Topo)
| Ativos | Vencendo (30d) | Vencidos | MRR Total |
|--------|----------------|----------|-----------|
| 28     | 1              | 3        | R$ 179k   |

### Tabela Principal
Exibe todos os contratos com:
- Nome do cliente clicável (navega para detalhe)
- Tipo de consultoria
- Período (início - fim)
- MRR
- Badge de status com cores:
  - **Ativo**: Verde
  - **Vencendo**: Amarelo
  - **Vencido**: Vermelho
  - **Encerrado**: Cinza

---

## Benefícios

1. **Visão Consolidada**: Ver todos os contratos em um só lugar
2. **Gestão Proativa**: Identificar contratos que precisam de atenção
3. **Histórico Completo**: Ver renovações e encerramentos
4. **Relatórios**: Facilita análise de churn e retenção

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/Contratos.tsx` | Criar |
| `src/hooks/useContratos.ts` | Adicionar `useAllContratos` |
| `src/components/layout/Sidebar.tsx` | Adicionar link |
| `src/App.tsx` | Adicionar rota |
