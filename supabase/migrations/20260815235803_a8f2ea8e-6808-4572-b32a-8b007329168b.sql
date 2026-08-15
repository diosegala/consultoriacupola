ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS decisao text CHECK (decisao IN ('aprovado','editado','rejeitado')),
  ADD COLUMN IF NOT EXISTS decisao_texto text,
  ADD COLUMN IF NOT EXISTS decisao_motivo text,
  ADD COLUMN IF NOT EXISTS decidido_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS decidido_em timestamptz;