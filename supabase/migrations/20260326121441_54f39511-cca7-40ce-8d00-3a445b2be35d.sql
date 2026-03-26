
ALTER TABLE public.projeto_checklist
  ADD COLUMN assigned_to uuid REFERENCES public.consultores(id) ON DELETE SET NULL,
  ADD COLUMN start_date date,
  ADD COLUMN due_date date;
