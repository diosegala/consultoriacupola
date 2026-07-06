
CREATE POLICY "Admins/directors gerenciam PDFs DISC"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'perfis-disc'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  )
  WITH CHECK (
    bucket_id = 'perfis-disc'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  );

CREATE POLICY "Consultor ve seu proprio PDF DISC"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'perfis-disc'
    AND (storage.foldername(name))[1] = public.get_consultor_id_for_user(auth.uid())::text
  );
