
CREATE TABLE public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  provider text not null,
  model text,
  agente_tipo text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  cliente_id uuid references public.clientes(id) on delete set null,
  consultor_id uuid references public.consultores(id) on delete set null,
  user_id uuid,
  status text not null default 'success',
  error_message text
);

CREATE INDEX ai_usage_logs_created_at_idx ON public.ai_usage_logs (created_at DESC);
CREATE INDEX ai_usage_logs_cliente_idx ON public.ai_usage_logs (cliente_id);
CREATE INDEX ai_usage_logs_consultor_idx ON public.ai_usage_logs (consultor_id);

GRANT SELECT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_logs_admin_director_select"
  ON public.ai_usage_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));
