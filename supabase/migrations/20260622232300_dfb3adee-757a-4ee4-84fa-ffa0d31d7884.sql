-- 1. Responsáveis múltiplos por item do checklist
CREATE TABLE public.projeto_checklist_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id uuid NOT NULL REFERENCES public.projeto_checklist(id) ON DELETE CASCADE,
  consultor_id uuid NOT NULL REFERENCES public.consultores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checklist_item_id, consultor_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_checklist_responsaveis TO authenticated;
GRANT ALL ON public.projeto_checklist_responsaveis TO service_role;

ALTER TABLE public.projeto_checklist_responsaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view checklist responsaveis"
  ON public.projeto_checklist_responsaveis FOR SELECT
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can insert checklist responsaveis"
  ON public.projeto_checklist_responsaveis FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can update checklist responsaveis"
  ON public.projeto_checklist_responsaveis FOR UPDATE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can delete checklist responsaveis"
  ON public.projeto_checklist_responsaveis FOR DELETE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE INDEX idx_pcr_item ON public.projeto_checklist_responsaveis(checklist_item_id);
CREATE INDEX idx_pcr_consultor ON public.projeto_checklist_responsaveis(consultor_id);

-- Migrar assigned_to existente
INSERT INTO public.projeto_checklist_responsaveis (checklist_item_id, consultor_id)
SELECT id, assigned_to
FROM public.projeto_checklist
WHERE assigned_to IS NOT NULL
ON CONFLICT DO NOTHING;

-- 2. To-do pessoal privado por usuário
CREATE TABLE public.todo_pessoal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  due_date date,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.todo_pessoal TO authenticated;
GRANT ALL ON public.todo_pessoal TO service_role;

ALTER TABLE public.todo_pessoal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own todos"
  ON public.todo_pessoal FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_todo_pessoal_user ON public.todo_pessoal(user_id);
CREATE INDEX idx_todo_pessoal_projeto ON public.todo_pessoal(projeto_id);

CREATE TRIGGER update_todo_pessoal_updated_at
  BEFORE UPDATE ON public.todo_pessoal
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();