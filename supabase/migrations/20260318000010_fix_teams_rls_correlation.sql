-- Fix correlation bug introduced while optimizing auth.uid() policy usage.
-- Ensure team_members.team_id compares against the outer teams row id.

ALTER POLICY "Team members can view team" ON public.teams
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.team_members
      WHERE team_id = teams.id
        AND user_id = (select auth.uid())
    )
  );
