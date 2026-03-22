-- Prevent users from flagging their own community content
DROP POLICY IF EXISTS "Authenticated users can flag" ON public.community_flags;

CREATE POLICY "Authenticated users can flag (not self)"
  ON public.community_flags FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.community_subjects s
      WHERE s.id = target_id AND s.author_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.subject_comments c
      WHERE c.id = target_id AND c.author_id = auth.uid()
    )
  );
