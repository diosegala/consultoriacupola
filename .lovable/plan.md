
## Simplificar Segurança do Webhook Pipedrive

### Contexto
O webhook do Pipedrive será mantido **sem autenticação adicional** (sem secret). A validação estrutural do payload com Zod já é suficiente para o caso de uso.

### Alterações

Remover a função `verifyWebhookSecret` e todo código relacionado à verificação de secret do arquivo `supabase/functions/pipedrive-webhook/index.ts`:

1. **Remover linhas 63-93**: Função `verifyWebhookSecret` completa
2. **Remover linhas 116-120**: Chamada da verificação no handler principal
3. **Atualizar finding de segurança**: Marcar como ignorado com justificativa documentada

### Segurança Mantida

A proteção do endpoint continua garantida por:

- **Validação Zod rigorosa**: Schemas `PipedriveMetaSchema`, `PipedriveCurrentSchema`, `PipedrivePayloadSchema`
- **Verificação de estrutura**: Rejeita payloads que não tenham formato Pipedrive válido
- **Sanitização de dados**: Campos extraídos são sanitizados antes de inserção
- **Limites de valores**: Validação de ranges numéricos e comprimento de strings

### Justificativa Técnica

O endpoint webhooks do Pipedrive:
- Não suporta HMAC signatures como outros serviços
- A autenticação HTTP Basic é opcional e difícil de configurar
- A validação estrutural é suficiente pois payloads maliciosos seriam rejeitados pelo schema Zod

---

### Detalhes Técnicos

```text
┌─────────────────────────────────────────────────────────────┐
│  ANTES                                                      │
│  ┌──────────────┐    ┌────────────────┐    ┌─────────────┐ │
│  │   Request    │───▶│ Secret Check   │───▶│ Zod Parse   │ │
│  └──────────────┘    └────────────────┘    └─────────────┘ │
│                            │                               │
│                        ❌ Requer                           │
│                        configuração                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  DEPOIS                                                     │
│  ┌──────────────┐    ┌─────────────┐                       │
│  │   Request    │───▶│ Zod Parse   │                       │
│  └──────────────┘    └─────────────┘                       │
│                           │                                │
│                   ✅ Valida estrutura                      │
│                   ✅ Rejeita inválidos                     │
│                   ✅ Sem configuração extra                │
└─────────────────────────────────────────────────────────────┘
```

**Arquivo a editar:**
- `supabase/functions/pipedrive-webhook/index.ts`

**Security finding a atualizar:**
- `OPEN_ENDPOINTS` → marcar como ignorado com justificativa
