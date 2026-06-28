
ALTER TABLE public.oraculo_settings
  ADD COLUMN IF NOT EXISTS cron_token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex');
