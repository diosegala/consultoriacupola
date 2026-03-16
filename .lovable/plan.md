

## Adicionar Filtragem por Pipeline na Edge Function

### Contexto

O Pipedrive envia webhooks para todos os pipelines. Precisamos filtrar para processar apenas deals do pipeline de **Consultoria**, ignorando os demais.

### Como funciona

O payload do Pipedrive inclui o campo `pipeline_id` (inteiro) no objeto `current`. Vamos:

1. **Criar um secret `PIPEDRIVE_PIPELINE_ID`** com o ID numérico do pipeline de Consultoria no Pipedrive
2. **Adicionar validação na edge function** logo após o check de "deal won" (linha 150), verificando se o `pipeline_id` do deal corresponde ao esperado

### Alteração na Edge Function

Após a verificação de deal won (linha 150-153), adicionar:

```typescript
// Filter by pipeline
const expectedPipelineId = Deno.env.get('PIPEDRIVE_PIPELINE_ID');
if (expectedPipelineId) {
  const dealPipelineId = String(payload.current?.pipeline_id);
  if (dealPipelineId !== expectedPipelineId) {
    console.log(`Evento ignorado - pipeline ${dealPipelineId} não é o esperado (${expectedPipelineId})`);
    return jsonResponse({ message: 'Evento ignorado - pipeline diferente' }, 200);
  }
}
```

Também atualizar o `PipedriveCurrentSchema` (linha 25) para incluir `pipeline_id`:

```typescript
pipeline_id: z.number().int().positive().optional(),
```

### Como descobrir o pipeline_id

No Pipedrive, acesse **Configurações > Pipelines** ou use a API. O ID aparece na URL ao abrir o pipeline.

### Arquivos a modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/pipedrive-webhook/index.ts` | Adicionar `pipeline_id` ao schema e validação por pipeline |
| Secrets | Criar `PIPEDRIVE_PIPELINE_ID` |

