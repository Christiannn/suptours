CREATE TABLE public.marketplace_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL UNIQUE,
  tags text[] NOT NULL DEFAULT '{}',
  address text,
  price_label text,
  contact_info text,
  image_urls text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX marketplace_products_is_active_idx
  ON public.marketplace_products(is_active);

CREATE INDEX marketplace_products_tags_idx
  ON public.marketplace_products USING gin(tags);

CREATE OR REPLACE FUNCTION public.handle_marketplace_products_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_marketplace_products_updated
  BEFORE UPDATE ON public.marketplace_products
  FOR EACH ROW EXECUTE FUNCTION public.handle_marketplace_products_updated_at();

ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active marketplace products"
  ON public.marketplace_products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage marketplace products"
  ON public.marketplace_products FOR ALL TO authenticated
  USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));
