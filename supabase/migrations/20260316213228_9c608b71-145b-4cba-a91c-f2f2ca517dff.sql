ALTER TABLE webhook_logs DROP CONSTRAINT webhook_logs_cliente_id_fkey;
ALTER TABLE webhook_logs ADD CONSTRAINT webhook_logs_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;