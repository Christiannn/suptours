-- Scraper: rigere metadata på kilder + provenance på kladder.

-- ── scraper_sources: klassifikation og driftstilstand ────────────────────────
ALTER TABLE public.scraper_sources
  ADD COLUMN IF NOT EXISTS kind                TEXT,
  ADD COLUMN IF NOT EXISTS relevance_score     INTEGER,
  ADD COLUMN IF NOT EXISTS ai_confidence       INTEGER,
  ADD COLUMN IF NOT EXISTS found_via           TEXT,
  ADD COLUMN IF NOT EXISTS last_error          TEXT,
  ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_event_count    INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.scraper_sources.kind IS
  'event_calendar | club | single_event | operator | other';
COMMENT ON COLUMN public.scraper_sources.relevance_score IS
  'Heuristisk score fra pre-filtret i fase 1';
COMMENT ON COLUMN public.scraper_sources.consecutive_failures IS
  'Antal skrabninger i træk uden resultat; bruges til at prioritere ned';

CREATE INDEX IF NOT EXISTS scraper_sources_active_idx
  ON public.scraper_sources (is_active, last_scraped_at NULLS FIRST);

-- ── scraper_runs: mere detaljeret log ────────────────────────────────────────
ALTER TABLE public.scraper_runs
  ADD COLUMN IF NOT EXISTS queries_run     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_results     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS events_rejected INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_url      TEXT,
  ADD COLUMN IF NOT EXISTS details         JSONB;

-- ── scraper_draft_meta: provenance for hver kladde ───────────────────────────
-- Holdes uden for `tours`, så den offentlige tabel ikke fyldes med
-- scraper-interne felter. Slettes automatisk med kladden.
CREATE TABLE IF NOT EXISTS public.scraper_draft_meta (
  tour_id       UUID PRIMARY KEY REFERENCES public.tours(id) ON DELETE CASCADE,
  source_url    TEXT NOT NULL,
  source_id     UUID REFERENCES public.scraper_sources(id) ON DELETE SET NULL,
  confidence    INTEGER NOT NULL DEFAULT 0,
  evidence      TEXT,
  price         TEXT,
  distance_km   NUMERIC(6,1),
  difficulty    TEXT,
  organizer     TEXT,
  identity_key  TEXT,
  extracted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scraper_draft_meta_identity_idx
  ON public.scraper_draft_meta (identity_key);
CREATE INDEX IF NOT EXISTS scraper_draft_meta_source_url_idx
  ON public.scraper_draft_meta (source_url);

ALTER TABLE public.scraper_draft_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage scraper_draft_meta"
  ON public.scraper_draft_meta FOR ALL TO authenticated
  USING      ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));
