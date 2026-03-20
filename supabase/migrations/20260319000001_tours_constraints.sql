-- Add CHECK constraints to tours table for data integrity
ALTER TABLE public.tours
  ADD CONSTRAINT tours_age_range_check CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max),
  ADD CONSTRAINT tours_age_min_nonneg CHECK (age_min IS NULL OR age_min >= 0),
  ADD CONSTRAINT tours_age_max_nonneg CHECK (age_max IS NULL OR age_max >= 0);
