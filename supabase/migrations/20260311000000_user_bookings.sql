CREATE TABLE public.user_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bookable_id text NOT NULL,
  bookable_name text NOT NULL,
  booking_date date NOT NULL,
  timeslot text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, bookable_id, booking_date, timeslot)
);

CREATE INDEX user_bookings_slot_idx
  ON public.user_bookings (bookable_id, booking_date, timeslot);

CREATE INDEX user_bookings_user_date_idx
  ON public.user_bookings (user_id, booking_date DESC, created_at DESC);

ALTER TABLE public.user_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings"
  ON public.user_bookings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bookings"
  ON public.user_bookings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookings"
  ON public.user_bookings
  FOR DELETE
  USING (auth.uid() = user_id);
