
-- Tags table
CREATE TABLE public.projeto_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome varchar NOT NULL,
  cor varchar NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tags" ON public.projeto_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authorized users can manage tags" ON public.projeto_tags FOR ALL TO authenticated USING (is_authorized_user(auth.uid())) WITH CHECK (is_authorized_user(auth.uid()));

-- Tag link table
CREATE TABLE public.projeto_tag_vinculo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.projeto_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(projeto_id, tag_id)
);

ALTER TABLE public.projeto_tag_vinculo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tag links" ON public.projeto_tag_vinculo FOR SELECT TO authenticated USING (
  is_authorized_user(auth.uid()) OR EXISTS (
    SELECT 1 FROM projetos p WHERE p.id = projeto_tag_vinculo.projeto_id AND p.consultor_id = get_consultor_id_for_user(auth.uid())
  )
);
CREATE POLICY "Authorized can manage tag links" ON public.projeto_tag_vinculo FOR INSERT TO authenticated WITH CHECK (
  is_authorized_user(auth.uid()) OR EXISTS (
    SELECT 1 FROM projetos p WHERE p.id = projeto_tag_vinculo.projeto_id AND p.consultor_id = get_consultor_id_for_user(auth.uid())
  )
);
CREATE POLICY "Authorized can delete tag links" ON public.projeto_tag_vinculo FOR DELETE TO authenticated USING (
  is_authorized_user(auth.uid()) OR EXISTS (
    SELECT 1 FROM projetos p WHERE p.id = projeto_tag_vinculo.projeto_id AND p.consultor_id = get_consultor_id_for_user(auth.uid())
  )
);
