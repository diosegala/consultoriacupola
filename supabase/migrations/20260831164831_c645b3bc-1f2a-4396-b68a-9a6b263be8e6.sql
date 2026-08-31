CREATE POLICY "chat_anexos_select_participante" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-anexos' AND public.is_chat_participante((storage.foldername(name))[1]::uuid, auth.uid()));

CREATE POLICY "chat_anexos_insert_participante" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-anexos' AND public.is_chat_participante((storage.foldername(name))[1]::uuid, auth.uid()));

CREATE POLICY "chat_anexos_delete_participante" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-anexos' AND public.is_chat_participante((storage.foldername(name))[1]::uuid, auth.uid()));