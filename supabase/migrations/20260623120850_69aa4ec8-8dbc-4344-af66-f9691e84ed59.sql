
-- Add ability to assign personal tasks to other consultants (admin/director only).
ALTER TABLE public.todo_pessoal
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_todo_pessoal_assigned_by ON public.todo_pessoal(assigned_by);
CREATE INDEX IF NOT EXISTS idx_todo_pessoal_user_id ON public.todo_pessoal(user_id);

-- Replace single ALL policy with granular policies.
DROP POLICY IF EXISTS "Users manage their own todos" ON public.todo_pessoal;

-- SELECT: owner OR who assigned it
CREATE POLICY "Todo select own or assigned by me"
ON public.todo_pessoal FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = assigned_by);

-- INSERT: self-created (no assigned_by) OR admin/director assigning to someone
CREATE POLICY "Todo insert own or admin assigning"
ON public.todo_pessoal FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user_id AND assigned_by IS NULL)
  OR (
    assigned_by = auth.uid()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  )
);

-- UPDATE: owner can update their own; assigner (admin/director) can update assigned tasks
CREATE POLICY "Todo update own or assigner"
ON public.todo_pessoal FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = assigned_by)
WITH CHECK (auth.uid() = user_id OR auth.uid() = assigned_by);

-- DELETE: only the assigner (or owner for self-created tasks where assigned_by is null)
CREATE POLICY "Todo delete own or assigner"
ON public.todo_pessoal FOR DELETE
TO authenticated
USING (
  (assigned_by IS NULL AND auth.uid() = user_id)
  OR auth.uid() = assigned_by
);

-- Trigger: assignee (when not the assigner) can only toggle `concluido`.
CREATE OR REPLACE FUNCTION public.todo_pessoal_restrict_assignee_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the row was assigned by someone else, and the current user is the assignee (not the assigner),
  -- they may only change `concluido` (and updated_at).
  IF NEW.assigned_by IS NOT NULL
     AND auth.uid() = NEW.user_id
     AND auth.uid() <> NEW.assigned_by THEN
    IF NEW.titulo IS DISTINCT FROM OLD.titulo
       OR NEW.due_date IS DISTINCT FROM OLD.due_date
       OR NEW.projeto_id IS DISTINCT FROM OLD.projeto_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
       OR NEW.ordem IS DISTINCT FROM OLD.ordem THEN
      RAISE EXCEPTION 'Você só pode marcar esta tarefa como concluída. Apenas quem atribuiu pode editar.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_todo_pessoal_restrict_assignee ON public.todo_pessoal;
CREATE TRIGGER trg_todo_pessoal_restrict_assignee
BEFORE UPDATE ON public.todo_pessoal
FOR EACH ROW EXECUTE FUNCTION public.todo_pessoal_restrict_assignee_update();
