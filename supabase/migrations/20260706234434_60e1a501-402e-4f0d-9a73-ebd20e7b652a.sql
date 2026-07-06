
-- Perfis comportamentais (DISC)
CREATE TABLE public.perfis_comportamentais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id uuid NOT NULL UNIQUE REFERENCES public.consultores(id) ON DELETE CASCADE,
  tipo_avaliacao text NOT NULL DEFAULT 'disc',
  data_avaliacao date,
  perfil_resumo jsonb NOT NULL,
  pdf_url text,
  raw_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_perfis_comport_consultor ON public.perfis_comportamentais (consultor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfis_comportamentais TO authenticated;
GRANT ALL ON public.perfis_comportamentais TO service_role;

ALTER TABLE public.perfis_comportamentais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/directors gerenciam todos perfis DISC"
  ON public.perfis_comportamentais FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "Consultor ve seu proprio DISC"
  ON public.perfis_comportamentais FOR SELECT TO authenticated
  USING (consultor_id = public.get_consultor_id_for_user(auth.uid()));

CREATE TRIGGER perfis_comport_updated_at
  BEFORE UPDATE ON public.perfis_comportamentais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cruzamentos Diretor x Consultora
CREATE TABLE public.cruzamentos_disc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diretor_id uuid NOT NULL REFERENCES public.consultores(id) ON DELETE CASCADE,
  consultor_id uuid NOT NULL REFERENCES public.consultores(id) ON DELETE CASCADE,
  analise jsonb NOT NULL,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diretor_id, consultor_id)
);

CREATE INDEX idx_cruz_disc_dir ON public.cruzamentos_disc (diretor_id);
CREATE INDEX idx_cruz_disc_cons ON public.cruzamentos_disc (consultor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cruzamentos_disc TO authenticated;
GRANT ALL ON public.cruzamentos_disc TO service_role;

ALTER TABLE public.cruzamentos_disc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/directors gerenciam cruzamentos DISC"
  ON public.cruzamentos_disc FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "Consultor ve cruzamento onde e a consultora"
  ON public.cruzamentos_disc FOR SELECT TO authenticated
  USING (consultor_id = public.get_consultor_id_for_user(auth.uid()));

CREATE TRIGGER cruz_disc_updated_at
  BEFORE UPDATE ON public.cruzamentos_disc
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
