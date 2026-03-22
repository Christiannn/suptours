-- Review audience + optional trip photo
ALTER TABLE public.tour_reviews
  ADD COLUMN visibility smallint NOT NULL DEFAULT 1 CHECK (visibility IN (0, 1, 2)),
  ADD COLUMN image_url text;

COMMENT ON COLUMN public.tour_reviews.visibility IS
  '0 = host (organizer) only, 1 = host + tour participants, 2 = public on site';

-- Keep historical full reviews public on the homepage
UPDATE public.tour_reviews
SET visibility = 2
WHERE declined = false AND rating_nature IS NOT NULL;

-- Replace broad public read with visibility-aware policies
DROP POLICY IF EXISTS "Public can view approved reviews" ON public.tour_reviews;

CREATE POLICY "Anyone reads site-wide visible reviews"
  ON public.tour_reviews FOR SELECT
  USING (
    approved = true
    AND declined = false
    AND visibility = 2
    AND rating_nature IS NOT NULL
  );

CREATE POLICY "Participants read participant-visible reviews"
  ON public.tour_reviews FOR SELECT
  TO authenticated
  USING (
    approved = true
    AND declined = false
    AND visibility = 1
    AND rating_nature IS NOT NULL
    AND (
      user_id = (select auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.tours t
        WHERE t.id = tour_reviews.tour_id AND t.creator_id = (select auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.tour_participants tp
        WHERE tp.tour_id = tour_reviews.tour_id AND tp.user_id = (select auth.uid())
      )
    )
  );

CREATE POLICY "Host reads host-only reviews"
  ON public.tour_reviews FOR SELECT
  TO authenticated
  USING (
    approved = true
    AND declined = false
    AND visibility = 0
    AND rating_nature IS NOT NULL
    AND (
      user_id = (select auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.tours t
        WHERE t.id = tour_reviews.tour_id AND t.creator_id = (select auth.uid())
      )
    )
  );

-- Storage: review photos (path = {user_id}/...)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tour-review-images', 'tour-review-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read tour review images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tour-review-images');

CREATE POLICY "Users upload own tour review images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tour-review-images'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "Users update own tour review images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tour-review-images'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "Users delete own tour review images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tour-review-images'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );
