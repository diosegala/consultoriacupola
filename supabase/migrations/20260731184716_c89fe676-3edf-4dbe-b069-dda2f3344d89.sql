CREATE TABLE public.reunioes_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id uuid NOT NULL REFERENCES public.reunioes(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  consultor_id uuid REFERENCES public.consultores(id) ON DELETE SET NULL,
  data_reuniao date,
  chunk_index integer NOT NULL DEFAULT 0,
  conteudo text NOT NULL,
  embedding vector(1536),
  hash_transcricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reunioes_chunks TO authenticated;
GRANT ALL ON public.reunioes_chunks TO service_role;

ALTER TABLE public.reunioes_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reunioes_chunks_select" ON public.reunioes_chunks
FOR SELECT TO authenticated
USING (
  public.is_admin_or_director(auth.uid())
  OR consultor_id IN (
    SELECT cu.consultor_id FROM public.consultor_user cu WHERE cu.user_id = auth.uid()
  )
);

CREATE INDEX reunioes_chunks_reuniao_idx ON public.reunioes_chunks(reuniao_id);
CREATE INDEX reunioes_chunks_cliente_idx ON public.reunioes_chunks(cliente_id);
CREATE INDEX reunioes_chunks_embedding_idx ON public.reunioes_chunks USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.buscar_trechos_reunioes(
  query_embedding vector(1536),
  match_count integer DEFAULT 12,
  p_cliente_id uuid DEFAULT NULL,
  p_consultor_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  reuniao_id uuid,
  cliente_id uuid,
  consultor_id uuid,
  data_reuniao date,
  chunk_index integer,
  conteudo text,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT rc.id, rc.reuniao_id, rc.cliente_id, rc.consultor_id, rc.data_reuniao,
         rc.chunk_index, rc.conteudo,
         1 - (rc.embedding <=> query_embedding) AS similarity
  FROM public.reunioes_chunks rc
  WHERE rc.embedding IS NOT NULL
    AND (p_cliente_id IS NULL OR rc.cliente_id = p_cliente_id)
    AND (p_consultor_id IS NULL OR rc.consultor_id = p_consultor_id)
    AND (p_data_inicio IS NULL OR rc.data_reuniao >= p_data_inicio)
    AND (p_data_fim IS NULL OR rc.data_reuniao <= p_data_fim)
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE EXECUTE ON FUNCTION public.buscar_trechos_reunioes(vector, integer, uuid, uuid, date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.buscar_trechos_reunioes(vector, integer, uuid, uuid, date, date) TO authenticated, service_role;