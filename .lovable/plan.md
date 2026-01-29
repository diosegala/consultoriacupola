
# Plano: Integração Completa com Pipedrive

## Objetivo
Automatizar a criação de clientes no sistema Cupola quando um deal é marcado como "ganho" no Pipedrive, via webhook.

---

## Arquitetura da Solução

```text
+----------------+       HTTP POST        +---------------------+
|   Pipedrive    | ---------------------->| Edge Function       |
|   Webhook      |   (deal.won event)     | pipedrive-webhook   |
+----------------+                        +---------------------+
                                                   |
                                                   v
                                          +---------------+
                                          |   Validação   |
                                          | - Assinatura  |
                                          | - Evento      |
                                          | - Duplicidade |
                                          +---------------+
                                                   |
                                                   v
                        +--------------------------+--------------------------+
                        |                          |                          |
                        v                          v                          v
                 +-------------+           +--------------+          +--------------+
                 |  clientes   |           |  contratos   |          | webhook_logs |
                 | (status:    |           | (ativo:true) |          | (registro)   |
                 |  'novo')    |           |              |          |              |
                 +-------------+           +--------------+          +--------------+
```

---

## Componentes a Implementar

### 1. Edge Function: `pipedrive-webhook`

Uma nova função para receber e processar webhooks do Pipedrive:

**Responsabilidades:**
- Receber payload do webhook (evento `deal.won` ou `updated` com status="won")
- Validar assinatura do webhook (se configurada)
- Verificar duplicidade via `pipedrive_deal_id`
- Criar cliente com status `novo`
- Criar contrato inicial baseado nos dados do deal
- Registrar log na tabela `webhook_logs`

**Mapeamento de campos Pipedrive → Cupola:**
| Pipedrive | Cupola |
|-----------|--------|
| `deal.id` | `clientes.pipedrive_deal_id` |
| `deal.title` ou `organization.name` | `clientes.nome` |
| `deal.value` | `contratos.remuneracao_total` |
| Campo customizado (cidade/UF) | `clientes.cidade`, `clientes.uf` |
| Campo customizado (prazo) | `contratos.prazo_meses` |

### 2. Configuração no Pipedrive

**Webhook a configurar:**
- **URL**: `https://wmmnbonigciftewukvum.supabase.co/functions/v1/pipedrive-webhook`
- **Eventos**: `deal.updated` (filtrar por `status = won`)
- **Método**: POST

### 3. Campos Customizados Necessários

Para extrair informações completas do deal, será preciso mapear campos customizados do Pipedrive:
- Cidade/UF do cliente
- Prazo do contrato (meses)
- Tipo de consultoria
- Remuneração mensal

---

## Detalhes Técnicos

### Edge Function `pipedrive-webhook`

```typescript
// Estrutura principal
Deno.serve(async (req) => {
  // 1. CORS preflight
  if (req.method === 'OPTIONS') return corsResponse();
  
  // 2. Validar método POST
  if (req.method !== 'POST') return error(405);
  
  // 3. Parsear payload
  const payload = await req.json();
  
  // 4. Registrar no webhook_logs (antes de processar)
  const logId = await insertWebhookLog(payload);
  
  // 5. Validar evento (deal won)
  if (!isDealWon(payload)) return success('Evento ignorado');
  
  // 6. Verificar duplicidade
  const dealId = payload.current?.id || payload.meta?.id;
  if (await clienteExiste(dealId)) return success('Já processado');
  
  // 7. Extrair dados e criar cliente + contrato
  const cliente = await criarCliente(payload);
  const contrato = await criarContrato(cliente.id, payload);
  
  // 8. Criar registros auxiliares
  await criarAtendimento(cliente.id);
  await criarOnboarding(cliente.id, contrato.id);
  await criarFerramentasCliente(cliente.id);
  
  // 9. Atualizar log como processado
  await updateWebhookLog(logId, cliente.id);
  
  return success({ cliente_id: cliente.id });
});
```

### Lógica de Extração de Dados

O webhook do Pipedrive envia dados no formato:
```json
{
  "meta": {
    "action": "updated",
    "object": "deal",
    "id": 12345
  },
  "current": {
    "id": 12345,
    "title": "Nome do Cliente",
    "status": "won",
    "value": 50000,
    "org_id": { "name": "Empresa XPTO" },
    "person_id": { "name": "João Silva" },
    "custom_fields": { ... }
  },
  "previous": { ... }
}
```

### Tratamento de Erros

- **Payload inválido**: Registrar erro no log, retornar 400
- **Deal duplicado**: Ignorar silenciosamente, retornar 200
- **Erro ao criar cliente**: Registrar no log, retornar 500
- **Campos obrigatórios faltando**: Usar valores default

---

## Configuração Necessária

### 1. Secrets do Supabase

| Secret | Descrição |
|--------|-----------|
| `PIPEDRIVE_WEBHOOK_SECRET` | (Opcional) Para validar assinatura do webhook |

### 2. Atualização do `supabase/config.toml`

```toml
[functions.pipedrive-webhook]
verify_jwt = false
```

---

## Interface Administrativa (Opcional - Fase 2)

Criar página `/configuracoes/pipedrive` para:
- Visualizar logs de webhooks processados
- Reprocessar webhooks com erro
- Mapear campos customizados do Pipedrive
- Testar conexão

---

## Fluxo Completo

1. Vendedor marca deal como "Ganho" no Pipedrive
2. Pipedrive dispara webhook para a Edge Function
3. Edge Function valida e extrai dados do payload
4. Sistema cria automaticamente:
   - Cliente (status: `novo`)
   - Contrato (ativo: `true`)
   - Atendimento (periodicidade padrão: `quinzenal`)
   - Onboarding (etapa: `pre_onboarding`)
   - Ferramentas do cliente (vazias)
5. Log é registrado na tabela `webhook_logs`
6. Cliente aparece na lista com status "Novo" pronto para onboarding

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/pipedrive-webhook/index.ts` | Criar |
| `supabase/config.toml` | Adicionar configuração da função |

---

## Próximos Passos Após Implementação

1. **Configurar webhook no Pipedrive**: Acessar Configurações → Webhooks → Adicionar
2. **Mapear campos customizados**: Identificar os IDs dos campos do Pipedrive para cidade, prazo, etc.
3. **Testar fluxo**: Criar deal de teste e marcar como ganho
4. **Monitorar logs**: Verificar tabela `webhook_logs` para debugar
