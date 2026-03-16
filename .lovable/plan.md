

## Corrigir erro de exclusão de cliente (foreign key webhook_logs)

### Problema

A foreign key `webhook_logs_cliente_id_fkey` não tem `ON DELETE CASCADE`, impedindo a exclusão de clientes que possuem logs de webhook.

### Solução

Uma migração SQL para recriar a constraint com `ON DELETE CASCADE`:

```sql
ALTER TABLE webhook_logs DROP CONSTRAINT webhook_logs_cliente_id_fkey;
ALTER TABLE webhook_logs ADD CONSTRAINT webhook_logs_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
```

Isso faz com que os registros em `webhook_logs` sejam automaticamente excluídos quando o cliente é removido, sem necessidade de alteração no código front-end (o `useDeleteCliente` já tenta deletar webhook_logs manualmente, mas a cascade garante que funcione mesmo se a ordem falhar).

