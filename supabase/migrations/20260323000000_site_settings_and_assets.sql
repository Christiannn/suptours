-- Key/value settings (e.g. home page marketing image URL)
CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.site_settings IS 'Public-readable site configuration; writes restricted to admins.';

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read site settings"
  ON public.site_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Admin insert site settings"
  ON public.site_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin update site settings"
  ON public.site_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin delete site settings"
  ON public.site_settings
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Public marketing assets (home trust section, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read site assets"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'site-assets');

CREATE POLICY "Admins upload site assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'site-assets' AND public.is_admin());

CREATE POLICY "Admins update site assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'site-assets' AND public.is_admin())
  WITH CHECK (bucket_id = 'site-assets' AND public.is_admin());

CREATE POLICY "Admins delete site assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'site-assets' AND public.is_admin());
