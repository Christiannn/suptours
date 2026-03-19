-- scraper_sources: discovered websites with SUP events
CREATE TABLE public.scraper_sources (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  url         TEXT        NOT NULL UNIQUE,
  domain      TEXT        NOT NULL,
  title       TEXT,
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  notes       TEXT,
  scrape_count INTEGER    NOT NULL DEFAULT 0,
  last_searched_at TIMESTAMPTZ DEFAULT NOW(),
  last_scraped_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- scraper_runs: audit log of each scraper execution
CREATE TABLE public.scraper_runs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type        TEXT        NOT NULL CHECK (run_type IN ('search', 'scrape')),
  status          TEXT        NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  sources_found   INTEGER     NOT NULL DEFAULT 0,
  events_created  INTEGER     NOT NULL DEFAULT 0,
  error_message   TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- updated_at trigger for scraper_sources
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_scraper_sources_updated_at
  BEFORE UPDATE ON public.scraper_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.scraper_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraper_runs     ENABLE ROW LEVEL SECURITY;

-- Only admins can access scraper tables
CREATE POLICY "Admins manage scraper_sources"
  ON public.scraper_sources FOR ALL TO authenticated
  USING   ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins manage scraper_runs"
  ON public.scraper_runs FOR ALL TO authenticated
  USING   ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));
