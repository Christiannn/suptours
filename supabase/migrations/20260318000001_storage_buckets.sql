-- Storage buckets for user avatars and tour images

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('tour-images', 'tour-images', true)
ON CONFLICT (id) DO NOTHING;

-- Avatars: public read
CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Avatars: users upload own (path starts with uid)
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Tour images: public read
CREATE POLICY "Public read tour images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tour-images');

-- Tour images: tour creator uploads (path starts with tour id, verified via tours table)
CREATE POLICY "Tour creators upload images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tour-images'
    AND EXISTS (
      SELECT 1 FROM public.tours t
      WHERE t.id::text = (storage.foldername(name))[1]
      AND t.creator_id = auth.uid()
    )
  );

CREATE POLICY "Tour creators delete images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tour-images'
    AND EXISTS (
      SELECT 1 FROM public.tours t
      WHERE t.id::text = (storage.foldername(name))[1]
      AND t.creator_id = auth.uid()
    )
  );
