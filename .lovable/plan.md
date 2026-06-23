# Notificações de vencimento de contratos por e-mail

## Visão geral
Job diário verifica contratos ativos e dispara e-mails para todos os usuários com papel `admin` ou `diretor` quando o contrato atingir exatamente 90, 60 ou 30 dias do vencimento. Cada (contrato, marco) é enviado uma única vez — controlado por tabela de log para evitar duplicatas.

## Pré-requisitos de infraestrutura
1. Configurar domínio de e-mail (Lovable Emails) via diálogo.
2. Rodar setup da infraestrutura de e-mail (filas, log, cron de envio).
3. Scaffold de e-mail transacional + registro do template.

## Banco de dados (migration)
- Nova tabela `contrato_vencimento_notificacoes`:
  - `id uuid pk`, `contrato_id uuid fk`, `marco int` (90/60/30), `enviado_em timestamptz`, `created_at`
  - `UNIQUE (contrato_id, marco)` para idempotência.
  - GRANT para `service_role` apenas; RLS habilitada e policy de leitura para admins.

## Template de e-mail
`supabase/functions/_shared/transactional-email-templates/contrato-vencimento.tsx`
- Assunto dinâmico: "X contratos vencem em {marco} dias" (ou nome do cliente se for 1).
- Conteúdo: tabela com cliente, consultor, tipo de consultoria, data fim, MRR.
- Botão "Ver contratos" → `https://<app>/contratos`.
- Registrar em `registry.ts`.

## Edge Function (cron)
Nova função `verificar-vencimentos-contratos`:
- Roda 1x/dia via `pg_cron`.
- Para cada marco em [90, 60, 30]:
  - Busca contratos `ativo=true` cuja `data_fim = CURRENT_DATE + marco`.
  - Filtra os que ainda não têm registro em `contrato_vencimento_notificacoes` para o marco.
  - Busca emails dos usuários com role `admin` ou `diretor` (via `user_roles` + `auth.users`).
  - Agrupa contratos por marco em um único e-mail por destinatário (idempotency key `vencimento-{marco}-{YYYYMMDD}-{userId}`).
  - Invoca `send-transactional-email` para cada destinatário.
  - Insere log em `contrato_vencimento_notificacoes` por contrato/marco.

## Agendamento
- Habilitar `pg_cron`/`pg_net`.
- Job diário às 09:00 BRT chamando a edge function via `net.http_post`.

## Detalhes técnicos
- Listagem de admins: `SELECT u.email FROM auth.users u JOIN user_roles r ON r.user_id=u.id WHERE r.role IN ('admin','diretor')`.
- Reuso de `getTipoConsultoriaLabel` para mostrar nome personalizado.
- Logs de envio visíveis em `email_send_log`.

## Fora de escopo
- UI para configurar destinatários/marcos (fixo em código).
- Notificações in-app (apenas e-mail).
- Reenvio manual a partir da UI.
