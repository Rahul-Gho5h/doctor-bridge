CREATE POLICY "DM participants read attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'medical-files'
  AND (storage.foldername(name))[1] = 'dm'
  AND EXISTS (
    SELECT 1 FROM public.direct_threads t
    WHERE t.id::text = (storage.foldername(name))[2]
      AND (t.user_a = auth.uid() OR t.user_b = auth.uid())
  )
);

CREATE POLICY "DM participants upload attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'medical-files'
  AND (storage.foldername(name))[1] = 'dm'
  AND EXISTS (
    SELECT 1 FROM public.direct_threads t
    WHERE t.id::text = (storage.foldername(name))[2]
      AND (t.user_a = auth.uid() OR t.user_b = auth.uid())
  )
);