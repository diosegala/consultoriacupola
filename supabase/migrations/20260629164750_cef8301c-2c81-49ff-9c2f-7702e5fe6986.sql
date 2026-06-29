
CREATE POLICY "Admins read all oraculo conversas" ON public.oraculo_conversas
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "Admins read all oraculo mensagens" ON public.oraculo_mensagens
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));
