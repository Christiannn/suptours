-- Add data integrity constraints to tour_reviews
ALTER TABLE public.tour_reviews
  ADD CONSTRAINT tour_reviews_rating_range CHECK (rating >= 1 AND rating <= 5),
  ADD CONSTRAINT tour_reviews_unique_per_user_tour UNIQUE (tour_id, reviewer_id);
