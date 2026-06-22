ALTER TABLE public.consultor_google_tokens
  ADD COLUMN IF NOT EXISTS pasta_meet_nome text,
  ADD COLUMN IF NOT EXISTS pasta_meet_link text,
  ADD COLUMN IF NOT EXISTS pasta_meet_owner_email text;