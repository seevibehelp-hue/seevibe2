
DROP POLICY IF EXISTS "Public can read platform samples" ON storage.objects;
CREATE POLICY "Public can read platform samples"
ON storage.objects FOR SELECT
USING (bucket_id = 'platform-samples');

DROP POLICY IF EXISTS "Admins can upload platform samples" ON storage.objects;
CREATE POLICY "Admins can upload platform samples"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'platform-samples' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update platform samples" ON storage.objects;
CREATE POLICY "Admins can update platform samples"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'platform-samples' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'platform-samples' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete platform samples" ON storage.objects;
CREATE POLICY "Admins can delete platform samples"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'platform-samples' AND public.has_role(auth.uid(), 'admin'));
