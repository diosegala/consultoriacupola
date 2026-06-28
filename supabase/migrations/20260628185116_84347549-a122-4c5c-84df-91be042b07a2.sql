
CREATE TABLE IF NOT EXISTS public.oraculo_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  embedding_model text NOT NULL DEFAULT 'openai/text-embedding-3-small',
  embedding_dimensions int NOT NULL DEFAULT 1536,
  chat_provider text NOT NULL DEFAULT 'lovable' CHECK (chat_provider IN ('lovable','anthropic')),
  chat_model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  ultima_sincronizacao_auto timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.oraculo_settings TO authenticated;
GRANT ALL ON public.oraculo_settings TO service_role;

ALTER TABLE public.oraculo_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin all oraculo_settings" ON public.oraculo_settings;
CREATE POLICY "admin all oraculo_settings" ON public.oraculo_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "authenticated read oraculo_settings" ON public.oraculo_settings;
CREATE POLICY "authenticated read oraculo_settings" ON public.oraculo_settings
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.oraculo_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
