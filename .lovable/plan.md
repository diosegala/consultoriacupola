

## Atualizar Webhook Pipedrive com HTTP Basic Authentication

### O que muda

O plano anterior usava token via query parameter. Como o Pipedrive oferece campos nativos de **Nome de usuario** e **Senha** HTTP Basic Auth, vamos usar essa abordagem -- mais segura e padrao.

### Como funciona

O Pipedrive envia o header `Authorization: Basic base64(usuario:senha)` automaticamente. A edge function decodifica e valida contra secrets armazenados.

### Passos

1. **Criar 2 secrets**: `PIPEDRIVE_WEBHOOK_USER` e `PIPEDRIVE_WEBHOOK_PASSWORD` com valores que voce definir
2. **Atualizar `supabase/functions/pipedrive-webhook/index.ts`**: Adicionar validacao de HTTP Basic Auth logo apos o check de metodo POST

### Alteracao na Edge Function

Adicionar apos a verificacao de POST (linha 76):

```typescript
// Validate HTTP Basic Auth
const authHeader = req.headers.get('Authorization');
if (!authHeader || !authHeader.startsWith('Basic ')) {
  return jsonResponse({ error: 'Autenticação necessária' }, 401);
}

const expectedUser = Deno.env.get('PIPEDRIVE_WEBHOOK_USER');
const expectedPass = Deno.env.get('PIPEDRIVE_WEBHOOK_PASSWORD');

const base64Credentials = authHeader.replace('Basic ', '');
const decoded = atob(base64Credentials);
const [user, pass] = decoded.split(':');

if (user !== expectedUser || pass !== expectedPass) {
  return jsonResponse({ error: 'Credenciais inválidas' }, 401);
}
```

### Configuracao no Pipedrive

Ao criar o webhook no Pipedrive, preencher:
- **URL**: `https://wmmnbonigciftewukvum.supabase.co/functions/v1/pipedrive-webhook`
- **Nome de usuario autent. HTTP**: o valor definido no secret `PIPEDRIVE_WEBHOOK_USER`
- **Senha autent. HTTP**: o valor definido no secret `PIPEDRIVE_WEBHOOK_PASSWORD`
- **Evento**: Deal updated

### Arquivos a modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/pipedrive-webhook/index.ts` | Adicionar validacao HTTP Basic Auth |
| Secrets | Criar `PIPEDRIVE_WEBHOOK_USER` e `PIPEDRIVE_WEBHOOK_PASSWORD` |

