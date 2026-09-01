ALTER TABLE public.consultores ADD COLUMN IF NOT EXISTS avatar_url text;

DROP FUNCTION IF EXISTS public.chat_diretorio_usuarios();

CREATE OR REPLACE FUNCTION public.chat_diretorio_usuarios()
 RETURNS TABLE(user_id uuid, nome text, avatar_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT cu.user_id, c.nome::text, c.avatar_url
  FROM public.consultor_user cu
  JOIN public.consultores c ON c.id = cu.consultor_id
  WHERE c.ativo = true
  ORDER BY c.nome
$function$;

CREATE POLICY "avatares_select_autorizados"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatares' AND public.is_authorized_user(auth.uid()));

CREATE POLICY "avatares_insert_proprio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatares' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatares_update_proprio"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatares' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatares' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatares_delete_proprio"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatares' AND (storage.foldername(name))[1] = auth.uid()::text);