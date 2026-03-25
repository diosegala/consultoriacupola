
-- Add due_date to projetos
ALTER TABLE public.projetos ADD COLUMN due_date date;

-- Create projeto_comentarios
CREATE TABLE public.projeto_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view projeto_comentarios"
  ON public.projeto_comentarios FOR SELECT TO authenticated
  USING (is_authorized_user(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.consultor_id = get_consultor_id_for_user(auth.uid())
  ));

CREATE POLICY "Authorized users can insert projeto_comentarios"
  ON public.projeto_comentarios FOR INSERT TO authenticated
  WITH CHECK (is_authorized_user(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.consultor_id = get_consultor_id_for_user(auth.uid())
  ));

CREATE POLICY "Authorized users can delete projeto_comentarios"
  ON public.projeto_comentarios FOR DELETE TO authenticated
  USING (is_authorized_user(auth.uid()) OR user_id = auth.uid());

-- Create projeto_checklist
CREATE TABLE public.projeto_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view projeto_checklist"
  ON public.projeto_checklist FOR SELECT TO authenticated
  USING (is_authorized_user(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.consultor_id = get_consultor_id_for_user(auth.uid())
  ));

CREATE POLICY "Authorized users can insert projeto_checklist"
  ON public.projeto_checklist FOR INSERT TO authenticated
  WITH CHECK (is_authorized_user(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.consultor_id = get_consultor_id_for_user(auth.uid())
  ));

CREATE POLICY "Authorized users can update projeto_checklist"
  ON public.projeto_checklist FOR UPDATE TO authenticated
  USING (is_authorized_user(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.consultor_id = get_consultor_id_for_user(auth.uid())
  ));

CREATE POLICY "Authorized users can delete projeto_checklist"
  ON public.projeto_checklist FOR DELETE TO authenticated
  USING (is_authorized_user(auth.uid()));
