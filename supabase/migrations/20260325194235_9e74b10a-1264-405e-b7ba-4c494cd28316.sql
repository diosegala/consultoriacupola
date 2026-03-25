
-- 1. Add 'consultor' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'consultor';

-- 2. Create consultor_user linking table
CREATE TABLE public.consultor_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consultor_id uuid NOT NULL REFERENCES public.consultores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(consultor_id)
);
ALTER TABLE public.consultor_user ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own link" ON public.consultor_user
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_authorized_user(auth.uid()));

CREATE POLICY "Admins can manage consultor_user" ON public.consultor_user
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Create projetos_etapas table
CREATE TABLE public.projetos_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome varchar NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.projetos_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view etapas" ON public.projetos_etapas
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage etapas" ON public.projetos_etapas
  FOR ALL TO authenticated
  USING (is_authorized_user(auth.uid()))
  WITH CHECK (is_authorized_user(auth.uid()));

-- 4. Seed initial etapas
INSERT INTO public.projetos_etapas (nome, ordem) VALUES
  ('Pré-Onboarding', 1),
  ('Onboarding', 2),
  ('Elaboração do Diagnóstico', 3),
  ('Apresentação do Diagnóstico', 4),
  ('Primeiro Cliente Oculto', 5),
  ('Elaboração de OKRs', 6),
  ('Reuniões de Acompanhamento', 7);

-- 5. Create projetos table
CREATE TABLE public.projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  consultor_id uuid NOT NULL REFERENCES public.consultores(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.projetos_etapas(id),
  ordem_na_etapa integer NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

-- Function to get consultor_id for current user
CREATE OR REPLACE FUNCTION public.get_consultor_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT consultor_id FROM public.consultor_user WHERE user_id = _user_id LIMIT 1
$$;

-- Admins/directors see all, consultors see only theirs
CREATE POLICY "Authorized users can view projetos" ON public.projetos
  FOR SELECT TO authenticated
  USING (
    is_authorized_user(auth.uid()) 
    OR consultor_id = get_consultor_id_for_user(auth.uid())
  );

CREATE POLICY "Authorized users can insert projetos" ON public.projetos
  FOR INSERT TO authenticated
  WITH CHECK (is_authorized_user(auth.uid()));

CREATE POLICY "Users can update projetos" ON public.projetos
  FOR UPDATE TO authenticated
  USING (
    is_authorized_user(auth.uid()) 
    OR consultor_id = get_consultor_id_for_user(auth.uid())
  );

CREATE POLICY "Admins can delete projetos" ON public.projetos
  FOR DELETE TO authenticated
  USING (is_authorized_user(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_projetos_updated_at
  BEFORE UPDATE ON public.projetos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
