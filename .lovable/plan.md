

## Modal de Clientes Ativos no Dashboard

### Objetivo
Ao clicar no card "Clientes Ativos" no Dashboard, abrir um modal que lista os clientes ativos (respeitando o filtro de consultor se aplicado), similar ao comportamento dos KPIs na página de Contratos.

### Alteracoes Necessarias

---

#### 1. Novo Hook para Listar Clientes Ativos

Criar uma funcao `useListaClientesAtivos` em `src/hooks/useClientes.ts` que retorna a lista completa de clientes ativos (nao apenas a contagem):

```typescript
export function useListaClientesAtivos(consultorId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'lista-clientes-ativos', consultorId],
    queryFn: async () => {
      let query = supabase
        .from('clientes')
        .select(`
          *,
          consultor:consultores(id, nome),
          contrato_ativo:contratos!contratos_cliente_id_fkey(
            id, remuneracao_mensal, data_fim, ativo,
            tipo_consultoria:tipos_consultoria(nome)
          )
        `)
        .eq('status', 'ativo')
        .order('nome');

      if (consultorId) {
        query = query.eq('consultor_id', consultorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return data.map(cliente => ({
        ...cliente,
        contrato_ativo: cliente.contrato_ativo?.find(c => c.ativo) || null
      }));
    }
  });
}
```

---

#### 2. Modal no Dashboard

Adicionar um estado e modal em `src/pages/Dashboard.tsx`:

**Estado:**
```typescript
const [showClientesAtivos, setShowClientesAtivos] = useState(false);
```

**Hook:**
```typescript
const { data: listaClientesAtivos } = useListaClientesAtivos(consultorIdFiltro);
```

**Card clicavel:**
```tsx
<Card 
  className="bg-card border-border cursor-pointer transition-all hover:scale-[1.02] hover:border-primary/50"
  onClick={() => setShowClientesAtivos(true)}
>
  ...
</Card>
```

**Modal:**
```tsx
<Dialog open={showClientesAtivos} onOpenChange={setShowClientesAtivos}>
  <DialogContent className="max-w-2xl max-h-[80vh]">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        Clientes Ativos
        {consultorFiltro !== 'todos' && (
          <Badge variant="outline" className="ml-2">
            Filtrado por consultor
          </Badge>
        )}
      </DialogTitle>
    </DialogHeader>
    
    <ScrollArea className="max-h-[60vh] pr-4">
      {listaClientesAtivos?.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Nenhum cliente ativo encontrado
        </p>
      ) : (
        <div className="space-y-3">
          {listaClientesAtivos?.map((cliente) => (
            <Card 
              key={cliente.id} 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => {
                setShowClientesAtivos(false);
                navigate(`/clientes/${cliente.id}`);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <span className="font-semibold">{cliente.nome}</span>
                    <p className="text-sm text-muted-foreground">
                      {cliente.cidade}, {cliente.uf}
                      {cliente.consultor && ` • ${cliente.consultor.nome}`}
                    </p>
                  </div>
                  {cliente.contrato_ativo && (
                    <span className="text-primary font-medium">
                      {formatCurrency(cliente.contrato_ativo.remuneracao_mensal)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ScrollArea>
  </DialogContent>
</Dialog>
```

---

### Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useClientes.ts` | Adicionar `useListaClientesAtivos` que retorna lista completa |
| `src/pages/Dashboard.tsx` | Adicionar estado, card clicavel, modal e importar componentes necessarios |

---

### Comportamento Esperado

1. Usuario clica no card "Clientes Ativos"
2. Modal abre com lista de clientes ativos
3. Se filtro de consultor estiver ativo, modal mostra apenas clientes daquele consultor
4. Ao clicar em um cliente, modal fecha e navega para pagina de detalhes do cliente

