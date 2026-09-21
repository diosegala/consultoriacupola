CREATE TABLE public.integracoes_credenciais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave text NOT NULL UNIQUE,
  credenciais jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT ALL ON public.integracoes_credenciais TO service_role;

ALTER TABLE public.integracoes_credenciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Somente o servidor acessa as credenciais"
ON public.integracoes_credenciais
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);