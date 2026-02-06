

## Corrigir Status de Clientes e Atualização Automática para 'Ativo'

### Problema Identificado

Os clientes estão sendo cadastrados com status "novo" e permanecem assim mesmo após terem um contrato ativo criado. Isso causa divergência no dashboard:
- O card "Clientes Ativos" conta apenas clientes com `status = 'ativo'`
- Clientes com contrato ativo mas status "novo" não são contabilizados
- O MRR também está sendo filtrado por clientes com status 'ativo', excluindo os "novos" com contrato

**Causa raiz:**
1. `ClienteNovo.tsx` (linha 57): cria cliente com `status: 'novo'`
2. `ClienteFormDialog.tsx` (linha 65, 86): default é `status: 'novo'`
3. `ContratoFormDialog`: ao criar contrato, não altera o status do cliente
4. Apenas `useRenovarContrato` atualiza o status para 'ativo' (linha 133-136)

### Solução

---

#### 1. Correção de dados históricos (Migration SQL)

Executar uma migration para corrigir clientes que já têm contrato ativo mas estão com status errado:

```sql
UPDATE clientes 
SET status = 'ativo', updated_at = now()
WHERE status = 'novo'
AND id IN (
  SELECT DISTINCT cliente_id 
  FROM contratos 
  WHERE ativo = true
);
```

---

#### 2. Automatizar status ao criar contrato

Modificar o hook `useCreateContrato` em `src/hooks/useContratos.ts` para:
- Após inserir o contrato, atualizar o status do cliente para 'ativo' se o contrato for ativo

```typescript
// Após criar contrato ativo, atualizar status do cliente
if (contrato.ativo) {
  await supabase
    .from('clientes')
    .update({ status: 'ativo' })
    .eq('id', contrato.cliente_id);
}
```

---

#### 3. Ajustar hooks do Dashboard

O dashboard está filtrando por `cliente.status = 'ativo'` para contar clientes e calcular MRR. Com a correção acima, isso passará a funcionar corretamente.

Mas também vamos garantir que:
- `useClientesAtivos` use a query key consistente `['dashboard', ...]`
- `useMRRTotal` considere apenas contratos ativos de clientes ativos

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Corrigir clientes existentes com status 'novo' que têm contrato ativo |
| `src/hooks/useContratos.ts` | Modificar `useCreateContrato` para atualizar status do cliente para 'ativo' |

---

### Fluxo Corrigido

```text
ANTES (problema)
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Criar       │────▶│ Cliente com  │────▶│ Criar       │
│ Cliente     │     │ status='novo'│     │ Contrato    │
└─────────────┘     └──────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    Cliente permanece    Dashboard NÃO conta
                    com status='novo'    este cliente

DEPOIS (corrigido)
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Criar       │────▶│ Cliente com  │────▶│ Criar       │
│ Cliente     │     │ status='novo'│     │ Contrato    │
└─────────────┘     └──────────────┘     └─────────────┘
                                               │
                                               ▼
                                         ┌─────────────┐
                                         │ Atualiza    │
                                         │ status para │
                                         │  'ativo'    │
                                         └─────────────┘
                                               │
                                               ▼
                                         Dashboard conta
                                         corretamente
```

---

### Resultado Esperado

Após as alterações:
1. Os 35 contratos ativos aparecerão no card "Clientes Ativos"
2. O MRR será calculado corretamente
3. Novos clientes com contrato terão status automaticamente alterado para 'ativo'

