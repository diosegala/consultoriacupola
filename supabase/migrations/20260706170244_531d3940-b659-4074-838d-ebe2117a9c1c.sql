
-- Table: cliente_arquivos
CREATE TABLE public.cliente_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('link', 'arquivo')),
  url text NOT NULL,
  categoria text,
  descricao text,
  adicionado_por uuid REFERENCES public.consultores(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cliente_arquivos_cliente_idx ON public.cliente_arquivos(cliente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_arquivos TO authenticated;
GRANT ALL ON public.cliente_arquivos TO service_role;

ALTER TABLE public.cliente_arquivos ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins gerenciam arquivos"
ON public.cliente_arquivos FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Consultors: only for their clients
CREATE POLICY "Consultor ve seus arquivos"
ON public.cliente_arquivos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = cliente_arquivos.cliente_id
      AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
  )
);

CREATE POLICY "Consultor insere para seus clientes"
ON public.cliente_arquivos FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = cliente_arquivos.cliente_id
      AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
  )
);

CREATE POLICY "Consultor edita seus arquivos"
ON public.cliente_arquivos FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = cliente_arquivos.cliente_id
      AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
  )
);

CREATE POLICY "Consultor remove os que adicionou"
ON public.cliente_arquivos FOR DELETE
TO authenticated
USING (
  adicionado_por = public.get_consultor_id_for_user(auth.uid())
);

-- Storage policies for bucket 'cliente-arquivos'
-- Path convention: {cliente_id}/{filename}
CREATE POLICY "cliente-arquivos: admin all"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'cliente-arquivos' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'cliente-arquivos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "cliente-arquivos: consultor read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'cliente-arquivos'
  AND EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
  )
);

CREATE POLICY "cliente-arquivos: consultor insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cliente-arquivos'
  AND EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
  )
);

CREATE POLICY "cliente-arquivos: consultor delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'cliente-arquivos'
  AND EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.consultor_id = public.get_consultor_id_for_user(auth.uid())
  )
);
