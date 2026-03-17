-- Fix infinite recursion in team_members SELECT policy.
-- The policy queried team_members within its own USING clause, causing recursion.
-- Use a SECURITY DEFINER function to check membership without triggering RLS.

CREATE OR REPLACE FUNCTION public.user_is_team_member(p_team_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = p_team_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Team members can view members" ON public.team_members;
CREATE POLICY "Team members can view members" ON public.team_members FOR SELECT
  USING (public.user_is_team_member(team_id, auth.uid()));
