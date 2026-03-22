-- Multi-axis tour reviews + decline flag; drop legacy single rating column.

ALTER TABLE public.tour_reviews
  ADD COLUMN rating_nature int,
  ADD COLUMN rating_access int,
  ADD COLUMN rating_hosts int,
  ADD COLUMN declined boolean NOT NULL DEFAULT false;

UPDATE public.tour_reviews
SET
  rating_nature = COALESCE(rating_nature, rating),
  rating_access = COALESCE(rating_access, rating),
  rating_hosts = COALESCE(rating_hosts, rating)
WHERE rating IS NOT NULL;

ALTER TABLE public.tour_reviews DROP COLUMN IF EXISTS rating;

ALTER TABLE public.tour_reviews
  ADD CONSTRAINT tour_reviews_rating_nature_range
    CHECK (rating_nature IS NULL OR (rating_nature >= 1 AND rating_nature <= 5)),
  ADD CONSTRAINT tour_reviews_rating_access_range
    CHECK (rating_access IS NULL OR (rating_access >= 1 AND rating_access <= 5)),
  ADD CONSTRAINT tour_reviews_rating_hosts_range
    CHECK (rating_hosts IS NULL OR (rating_hosts >= 1 AND rating_hosts <= 5)),
  ADD CONSTRAINT tour_reviews_submit_shape CHECK (
    (declined = true AND rating_nature IS NULL AND rating_access IS NULL AND rating_hosts IS NULL)
    OR
    (declined = false AND rating_nature IS NOT NULL AND rating_access IS NOT NULL AND rating_hosts IS NOT NULL)
  );

-- Profile / pending prompts: users must read their own rows (declined or draft).
CREATE POLICY "Users can view own tour reviews"
  ON public.tour_reviews FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));
