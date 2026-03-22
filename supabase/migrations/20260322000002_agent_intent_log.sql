-- GET /api/x-bot-agent-intent — log URL query params from bots/agents (product research)
CREATE TABLE public.agent_intent_log (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	created_at timestamptz NOT NULL DEFAULT now(),
	query_params jsonb NOT NULL DEFAULT '{}'::jsonb,
	intent_summary text,
	raw_query text,
	referrer text,
	user_agent text
);

COMMENT ON TABLE public.agent_intent_log IS 'Agent/bot GET query log — what callers pass in the URL search string.';

CREATE INDEX agent_intent_log_created_at_idx ON public.agent_intent_log (created_at DESC);

ALTER TABLE public.agent_intent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert agent intent log"
	ON public.agent_intent_log
	FOR INSERT
	TO anon, authenticated
	WITH CHECK (true);

CREATE POLICY "Admins can read agent intent log"
	ON public.agent_intent_log
	FOR SELECT
	TO authenticated
	USING (public.is_admin());

CREATE POLICY "Admins can delete agent intent log"
	ON public.agent_intent_log
	FOR DELETE
	TO authenticated
	USING (public.is_admin());
