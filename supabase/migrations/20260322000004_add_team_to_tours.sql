-- Allow user-created tours to be optionally hosted by a team.
ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tours_team_id_idx ON public.tours(team_id);

-- Recreate write policies so team-hosted tours require edit/super team access.
DROP POLICY IF EXISTS "Authenticated users can create tours" ON public.tours;
CREATE POLICY "Authenticated users can create tours"
  ON public.tours FOR INSERT
  TO authenticated
  WITH CHECK (
    creator_id = (select auth.uid())
    AND (
      team_id IS NULL
      OR public.user_has_team_role(team_id, (select auth.uid()), 'edit')
    )
  );

DROP POLICY IF EXISTS "Creators can update own tours" ON public.tours;
CREATE POLICY "Creators can update own tours"
  ON public.tours FOR UPDATE
  TO authenticated
  USING (creator_id = (select auth.uid()))
  WITH CHECK (
    creator_id = (select auth.uid())
    AND (
      team_id IS NULL
      OR public.user_has_team_role(team_id, (select auth.uid()), 'edit')
    )
  );
