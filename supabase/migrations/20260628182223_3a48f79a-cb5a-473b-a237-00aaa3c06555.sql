CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.oraculo_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  conteudo text NOT NULL,
  embedding vector(1536),
  categoria text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.oraculo_knowledge TO authenticated;
GRANT ALL ON public.oraculo_knowledge TO service_role;

ALTER TABLE public.oraculo_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read knowledge"
  ON public.oraculo_knowledge FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage knowledge"
  ON public.oraculo_knowledge FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX oraculo_knowledge_embedding_idx
  ON public.oraculo_knowledge
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE OR REPLACE FUNCTION public.buscar_conhecimento(
  query_embedding vector(1536),
  match_count int DEFAULT 5
)
RETURNS TABLE(id uuid, titulo text, conteudo text, categoria text, similarity float)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, titulo, conteudo, categoria, 1 - (embedding <=> query_embedding) AS similarity
  FROM public.oraculo_knowledge
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE EXECUTE ON FUNCTION public.buscar_conhecimento(vector, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_conhecimento(vector, int) TO service_role;