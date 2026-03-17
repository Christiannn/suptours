-- Tours: the core data model for SUP tour listings

CREATE TYPE tour_source AS ENUM ('user', 'web');
CREATE TYPE tour_status AS ENUM ('draft', 'published', 'cancelled', 'completed');

CREATE TABLE public.tours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source tour_source NOT NULL DEFAULT 'user',
  status tour_status NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  description text,
  image_url text,
  start_date date NOT NULL,
  start_time time,
  end_date date,
  locality text,
  latitude double precision,
  longitude double precision,
  parking_info text,
  max_participants int,
  age_min int DEFAULT 0,
  age_max int DEFAULT 120,
  security_notes text,
  responsible_person text,
  contact_info text,
  tags text[] NOT NULL DEFAULT '{}',
  external_url text,
  view_count int NOT NULL DEFAULT 0,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX tours_start_date_idx ON public.tours(start_date);
CREATE INDEX tours_status_idx ON public.tours(status);
CREATE INDEX tours_creator_idx ON public.tours(creator_id);
CREATE INDEX tours_tags_idx ON public.tours USING gin(tags);

-- Tour participants (users who join a tour)
CREATE TABLE public.tour_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(tour_id, user_id)
);

CREATE INDEX tour_participants_tour_idx ON public.tour_participants(tour_id);
CREATE INDEX tour_participants_user_idx ON public.tour_participants(user_id);

-- Tour reviews (post-tour ratings)
CREATE TABLE public.tour_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tour_id, user_id)
);

CREATE INDEX tour_reviews_tour_idx ON public.tour_reviews(tour_id);
CREATE INDEX tour_reviews_approved_idx ON public.tour_reviews(approved) WHERE approved = true;

-- RLS Policies

ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_reviews ENABLE ROW LEVEL SECURITY;

-- Tours: anyone can read published tours
CREATE POLICY "Public can view published tours"
  ON public.tours FOR SELECT
  USING (status = 'published');

-- Tours: creators can see their own tours (all statuses)
CREATE POLICY "Creators can view own tours"
  ON public.tours FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

-- Tours: authenticated users can create tours
CREATE POLICY "Authenticated users can create tours"
  ON public.tours FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

-- Tours: creators can update own tours
CREATE POLICY "Creators can update own tours"
  ON public.tours FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- Tours: creators can delete own tours
CREATE POLICY "Creators can delete own tours"
  ON public.tours FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- Participants: anyone can see participants of published tours
CREATE POLICY "Public can view tour participants"
  ON public.tour_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tours t
      WHERE t.id = tour_id AND (t.status = 'published' OR t.creator_id = auth.uid())
    )
  );

-- Participants: authenticated users can join tours
CREATE POLICY "Authenticated users can join tours"
  ON public.tour_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Participants: users can leave tours
CREATE POLICY "Users can leave tours"
  ON public.tour_participants FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Reviews: anyone can read approved reviews
CREATE POLICY "Public can view approved reviews"
  ON public.tour_reviews FOR SELECT
  USING (approved = true);

-- Reviews: authenticated users can create reviews
CREATE POLICY "Authenticated users can create reviews"
  ON public.tour_reviews FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Reviews: users can update own reviews
CREATE POLICY "Users can update own reviews"
  ON public.tour_reviews FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Updated_at trigger for tours
CREATE OR REPLACE FUNCTION public.handle_tour_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_tour_updated
  BEFORE UPDATE ON public.tours
  FOR EACH ROW EXECUTE FUNCTION public.handle_tour_updated_at();
