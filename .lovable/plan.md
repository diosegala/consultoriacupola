

## Configurar Secrets para Autenticação do Webhook Pipedrive

### O que fazer

Criar dois secrets no backend do projeto usando a ferramenta `add_secret`:

1. **`PIPEDRIVE_WEBHOOK_USER`** — Nome de usuário que será usado no campo "Nome de usuário autent. HTTP" do Pipedrive
2. **`PIPEDRIVE_WEBHOOK_PASSWORD`** — Senha que será usada no campo "Senha autent. HTTP" do Pipedrive

### Como funciona

- Ao executar, o sistema pedirá que você insira o valor de cada secret
- Você pode escolher qualquer valor (ex: `cupola_webhook` para user e uma senha forte para password)
- Depois, basta preencher os mesmos valores nos campos de autenticação HTTP do webhook no Pipedrive

### Nenhuma alteração de código necessária

A edge function já foi atualizada na mensagem anterior para ler esses secrets. Só falta criá-los.

