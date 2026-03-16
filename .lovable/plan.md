

## Corrigir Schema do Webhook para Pipedrive v2

### Problema encontrado

Os logs mostram que o webhook **ja esta sendo chamado** pelo Pipedrive, mas **falha na validacao Zod** porque o formato do payload e da API v2 do Pipedrive, diferente do que o schema espera. Erros concretos:

| Campo | Schema espera | Pipedrive envia |
|-------|--------------|-----------------|
| `meta.action` | `added/updated/deleted/merged` | `"change"` |
| `meta.object` | `"deal"` (obrigatorio) | Nao existe (usa `meta.entity`) |
| `meta.id` | `number` | `string` (UUID) |
| `meta.timestamp` | `number` | `string` (ISO date) |
| `meta.company_id` | `number` | `string` |
| `meta.user_id` | `number` | `string` |
| `meta.permitted_user_ids` | `number[]` | `string[]` |
| `data` vs `current` | `current` | Pipedrive v2 usa `data` como raiz |

### Alteracoes necessarias

**Arquivo:** `supabase/functions/pipedrive-webhook/index.ts`

1. **Atualizar `PipedriveMetaSchema`** para aceitar o formato v2:
   - `action`: adicionar `"change"` ao enum
   - Remover `object: z.literal('deal')`, usar `entity: z.literal('deal').optional()`
   - `id`: aceitar `z.union([z.number(), z.string()])`
   - `timestamp`: aceitar `z.union([z.number(), z.string()])`
   - `company_id`, `user_id`: aceitar `z.union([z.number(), z.string()])`
   - `permitted_user_ids`: aceitar `z.array(z.union([z.number(), z.string()]))`

2. **Atualizar `PipedrivePayloadSchema`** para aceitar tanto `current` quanto `data` (v2 usa `data` em vez de `current`):
   - Adicionar `data` como alternativa a `current`
   - Normalizar para `current` internamente

3. **Atualizar `checkIfDealWon`** para aceitar `action === 'change'` alem de `'updated'`

4. **Redesenhar** apos as alteracoes

### Detalhes tecnicos

O payload real do Pipedrive v2 tem esta estrutura:
```
{ data: {...}, previous: {...}, meta: { action: "change", entity: "deal", ... } }
```

O schema atual espera:
```
{ current: {...}, previous: {...}, meta: { action: "updated", object: "deal", ... } }
```

A correcao mapeia `data` -> `current` e flexibiliza os tipos do `meta`.

