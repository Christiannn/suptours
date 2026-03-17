-- Galleries
CREATE TABLE public.galleries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text,
  active boolean NOT NULL DEFAULT true,
  edited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  edited_on timestamptz NOT NULL DEFAULT now()
);

-- Gallery images
CREATE TABLE public.gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  description text,
  quote text,
  tags text[] NOT NULL DEFAULT '{}',
  link_to_url text,
  edited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  edited_on timestamptz NOT NULL DEFAULT now(),
  hidden boolean NOT NULL DEFAULT false
);

CREATE INDEX gallery_images_gallery_id_idx ON public.gallery_images(gallery_id);
CREATE INDEX gallery_images_hidden_idx ON public.gallery_images(hidden);

ALTER TABLE public.galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

-- Public users can read active galleries and visible images.
CREATE POLICY "Public can view active galleries"
  ON public.galleries
  FOR SELECT
  USING (active = true);

CREATE POLICY "Authenticated can view all galleries"
  ON public.galleries
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can create galleries"
  ON public.galleries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = edited_by);

CREATE POLICY "Authenticated can update galleries"
  ON public.galleries
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (auth.uid() = edited_by);

CREATE POLICY "Authenticated can delete galleries"
  ON public.galleries
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Public can view visible gallery images"
  ON public.gallery_images
  FOR SELECT
  USING (
    hidden = false
    AND EXISTS (
      SELECT 1
      FROM public.galleries g
      WHERE g.id = gallery_images.gallery_id
        AND g.active = true
    )
  );

CREATE POLICY "Authenticated can view all gallery images"
  ON public.gallery_images
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can create gallery images"
  ON public.gallery_images
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = edited_by);

CREATE POLICY "Authenticated can update gallery images"
  ON public.gallery_images
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (auth.uid() = edited_by);

CREATE POLICY "Authenticated can delete gallery images"
  ON public.gallery_images
  FOR DELETE
  TO authenticated
  USING (true);

-- Keep edited_on current.
CREATE OR REPLACE FUNCTION public.set_edited_on_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.edited_on = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER galleries_set_edited_on
  BEFORE UPDATE ON public.galleries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_edited_on_timestamp();

CREATE TRIGGER gallery_images_set_edited_on
  BEFORE UPDATE ON public.gallery_images
  FOR EACH ROW
  EXECUTE FUNCTION public.set_edited_on_timestamp();

-- Create storage bucket for gallery uploads.
INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery-images', 'gallery-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for gallery bucket.
CREATE POLICY "Public read gallery-images bucket"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'gallery-images');

-- Authenticated users can upload/update/delete gallery bucket files.
CREATE POLICY "Authenticated upload gallery-images bucket"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'gallery-images');

CREATE POLICY "Authenticated update gallery-images bucket"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'gallery-images')
  WITH CHECK (bucket_id = 'gallery-images');

CREATE POLICY "Authenticated delete gallery-images bucket"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'gallery-images');
