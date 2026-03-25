
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS force_password_change boolean NOT NULL DEFAULT false;

CREATE POLICY "Users can update own force_password_change"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
