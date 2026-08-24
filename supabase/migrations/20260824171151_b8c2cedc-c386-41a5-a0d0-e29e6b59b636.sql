DROP POLICY IF EXISTS "Admins/directors gerenciam todas interacoes" ON public.interacoes_cliente;
DROP POLICY IF EXISTS "Consultores editam suas interacoes" ON public.interacoes_cliente;
DROP POLICY IF EXISTS "Consultores excluem suas interacoes" ON public.interacoes_cliente;
DROP POLICY IF EXISTS "Consultores registram interacoes de seus clientes" ON public.interacoes_cliente;
DROP POLICY IF EXISTS "Consultores veem interacoes de seus clientes" ON public.interacoes_cliente;

REVOKE ALL ON public.interacoes_cliente FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interacoes_cliente TO authenticated;
GRANT ALL ON public.interacoes_cliente TO service_role;

CREATE POLICY "Admins/directors gerenciam todas interacoes"
ON public.interacoes_cliente FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Consultores veem interacoes de seus clientes"
ON public.interacoes_cliente FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM clientes c WHERE c.id = interacoes_cliente.cliente_id AND c.consultor_id = get_consultor_id_for_user(auth.uid())));

CREATE POLICY "Consultores registram interacoes de seus clientes"
ON public.interacoes_cliente FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM clientes c WHERE c.id = interacoes_cliente.cliente_id AND c.consultor_id = get_consultor_id_for_user(auth.uid())));

CREATE POLICY "Consultores editam suas interacoes"
ON public.interacoes_cliente FOR UPDATE TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Consultores excluem suas interacoes"
ON public.interacoes_cliente FOR DELETE TO authenticated
USING (created_by = auth.uid());