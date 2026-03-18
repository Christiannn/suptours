CREATE POLICY "Authenticated users upload tour images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tour-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Authenticated users update tour images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'tour-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Authenticated users delete tour images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'tour-images' AND (storage.foldername(name))[1] = auth.uid()::text);
