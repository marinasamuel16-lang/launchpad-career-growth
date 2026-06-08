
DROP POLICY IF EXISTS "Users view own avatar" ON storage.objects;
CREATE POLICY "Avatars viewable by authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
