
CREATE POLICY "deny_all_client_select_contestacao_documentos"
ON storage.objects AS RESTRICTIVE
FOR SELECT TO anon, authenticated
USING (bucket_id <> 'contestacao-documentos');

CREATE POLICY "deny_all_client_insert_contestacao_documentos"
ON storage.objects AS RESTRICTIVE
FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id <> 'contestacao-documentos');

CREATE POLICY "deny_all_client_update_contestacao_documentos"
ON storage.objects AS RESTRICTIVE
FOR UPDATE TO anon, authenticated
USING (bucket_id <> 'contestacao-documentos')
WITH CHECK (bucket_id <> 'contestacao-documentos');

CREATE POLICY "deny_all_client_delete_contestacao_documentos"
ON storage.objects AS RESTRICTIVE
FOR DELETE TO anon, authenticated
USING (bucket_id <> 'contestacao-documentos');
