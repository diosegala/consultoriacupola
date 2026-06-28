
ALTER TABLE public.oraculo_knowledge
  ADD COLUMN IF NOT EXISTS notion_page_id text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS chunk_index integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_edited_time timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS oraculo_knowledge_notion_chunk_uk
  ON public.oraculo_knowledge (notion_page_id, chunk_index)
  WHERE notion_page_id IS NOT NULL;
