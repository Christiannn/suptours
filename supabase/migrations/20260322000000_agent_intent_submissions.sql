-- Voluntary submissions from crawlers / AI agents (product & service research leads)
CREATE TABLE public.agent_intent_submissions (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	created_at timestamptz NOT NULL DEFAULT now(),
	purpose text,
	search_query text,
	users_looking_for text,
	notes text,
	referrer text,
	user_agent text
);

COMMENT ON TABLE public.agent_intent_submissions IS 'Optional POST /api/agent-intent — what visitors are trying to find in SUP / watersports.';

CREATE INDEX agent_intent_submissions_created_at_idx ON public.agent_intent_submissions (created_at DESC);

ALTER TABLE public.agent_intent_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert agent intent"
	ON public.agent_intent_submissions
	FOR INSERT
	TO anon, authenticated
	WITH CHECK (true);

CREATE POLICY "Admins can read agent intents"
	ON public.agent_intent_submissions
	FOR SELECT
	TO authenticated
	USING (public.is_admin());
