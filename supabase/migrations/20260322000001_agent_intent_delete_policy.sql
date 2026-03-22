-- Admins may delete agent intent rows (admin UI)
CREATE POLICY "Admins can delete agent intents"
	ON public.agent_intent_submissions
	FOR DELETE
	TO authenticated
	USING (public.is_admin());
