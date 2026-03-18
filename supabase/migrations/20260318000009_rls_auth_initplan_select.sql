-- Performance hardening for RLS:
-- Wrap row-independent auth.uid() calls in SELECT so Postgres can initPlan-cache
-- values per statement instead of re-evaluating per row.

-- teams
ALTER POLICY "Team members can view team" ON public.teams
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.team_members
      WHERE team_id = teams.id AND user_id = (select auth.uid())
    )
  );

ALTER POLICY "Authenticated users can create team" ON public.teams
  WITH CHECK ((select auth.uid()) = created_by);

ALTER POLICY "Creator or super can update team" ON public.teams
  USING (public.user_can_manage_team(id, (select auth.uid())));

ALTER POLICY "Creator or super can delete team" ON public.teams
  USING (public.user_can_manage_team(id, (select auth.uid())));

-- team_roles
ALTER POLICY "Team members can view roles" ON public.team_roles
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_members
      WHERE team_id = team_roles.team_id AND user_id = (select auth.uid())
    )
  );

ALTER POLICY "Creator or super can insert roles" ON public.team_roles
  WITH CHECK (public.user_can_manage_team(team_id, (select auth.uid())));

ALTER POLICY "Creator or super can update roles" ON public.team_roles
  USING (public.user_can_manage_team(team_id, (select auth.uid())));

ALTER POLICY "Creator or super can delete roles" ON public.team_roles
  USING (public.user_can_manage_team(team_id, (select auth.uid())));

-- team_members
ALTER POLICY "Team members can view members" ON public.team_members
  USING (public.user_is_team_member(team_id, (select auth.uid())));

ALTER POLICY "Creator or super can add members" ON public.team_members
  WITH CHECK (public.user_can_manage_team(team_id, (select auth.uid())));

ALTER POLICY "Creator or super can update members" ON public.team_members
  USING (public.user_can_manage_team(team_id, (select auth.uid())));

ALTER POLICY "Creator or super can delete members" ON public.team_members
  USING (public.user_can_manage_team(team_id, (select auth.uid())));

-- blog_posts
ALTER POLICY "Blog posts select" ON public.blog_posts
  USING (
    author_id = (select auth.uid())
    OR (team_id IS NULL AND is_draft = false)
    OR (
      team_id IS NOT NULL
      AND is_draft = false
      AND EXISTS (
        SELECT 1
        FROM public.team_members
        WHERE team_id = blog_posts.team_id
          AND user_id = (select auth.uid())
      )
    )
    OR (
      team_id IS NOT NULL
      AND is_draft = true
      AND EXISTS (
        SELECT 1
        FROM public.team_members
        WHERE team_id = blog_posts.team_id
          AND user_id = (select auth.uid())
      )
    )
  );

-- user_bookings
ALTER POLICY "Users can view own bookings" ON public.user_bookings
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can create own bookings" ON public.user_bookings
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can delete own bookings" ON public.user_bookings
  USING ((select auth.uid()) = user_id);

-- tours
ALTER POLICY "Creators can view own tours" ON public.tours
  USING (creator_id = (select auth.uid()));

ALTER POLICY "Authenticated users can create tours" ON public.tours
  WITH CHECK (creator_id = (select auth.uid()));

ALTER POLICY "Creators can update own tours" ON public.tours
  USING (creator_id = (select auth.uid()));

ALTER POLICY "Creators can update own tours" ON public.tours
  WITH CHECK (creator_id = (select auth.uid()));

ALTER POLICY "Creators can delete own tours" ON public.tours
  USING (creator_id = (select auth.uid()));

ALTER POLICY "Public can view tour participants" ON public.tour_participants
  USING (
    EXISTS (
      SELECT 1
      FROM public.tours t
      WHERE t.id = tour_id
        AND (t.status = 'published' OR t.creator_id = (select auth.uid()))
    )
  );

ALTER POLICY "Authenticated users can join tours" ON public.tour_participants
  WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY "Users can leave tours" ON public.tour_participants
  USING (user_id = (select auth.uid()));

ALTER POLICY "Authenticated users can create reviews" ON public.tour_reviews
  WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY "Users can update own reviews" ON public.tour_reviews
  USING (user_id = (select auth.uid()));

ALTER POLICY "Users can update own reviews" ON public.tour_reviews
  WITH CHECK (user_id = (select auth.uid()));

-- community
ALTER POLICY "Authenticated users can create subjects" ON public.community_subjects
  WITH CHECK ((select auth.uid()) = author_id);

ALTER POLICY "Authors can update own subjects" ON public.community_subjects
  USING ((select auth.uid()) = author_id);

ALTER POLICY "Authors can delete own subjects" ON public.community_subjects
  USING ((select auth.uid()) = author_id OR public.is_admin());

ALTER POLICY "Authenticated users can create comments" ON public.subject_comments
  WITH CHECK ((select auth.uid()) = author_id);

ALTER POLICY "Authors can delete own comments" ON public.subject_comments
  USING ((select auth.uid()) = author_id OR public.is_admin());

ALTER POLICY "Authenticated users can flag" ON public.community_flags
  WITH CHECK ((select auth.uid()) = reporter_id);

ALTER POLICY "Users can see own flags" ON public.community_flags
  USING ((select auth.uid()) = reporter_id OR public.is_admin());

-- galleries
ALTER POLICY "Authenticated can create galleries" ON public.galleries
  WITH CHECK ((select auth.uid()) = edited_by);

ALTER POLICY "Authenticated can update galleries" ON public.galleries
  WITH CHECK ((select auth.uid()) = edited_by);

ALTER POLICY "Authenticated can create gallery images" ON public.gallery_images
  WITH CHECK ((select auth.uid()) = edited_by);

ALTER POLICY "Authenticated can update gallery images" ON public.gallery_images
  WITH CHECK ((select auth.uid()) = edited_by);

-- storage.objects
ALTER POLICY "Users upload own avatar" ON storage.objects
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

ALTER POLICY "Users update own avatar" ON storage.objects
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

ALTER POLICY "Users delete own avatar" ON storage.objects
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

ALTER POLICY "Tour creators upload images" ON storage.objects
  WITH CHECK (
    bucket_id = 'tour-images'
    AND EXISTS (
      SELECT 1
      FROM public.tours t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND t.creator_id = (select auth.uid())
    )
  );

ALTER POLICY "Tour creators delete images" ON storage.objects
  USING (
    bucket_id = 'tour-images'
    AND EXISTS (
      SELECT 1
      FROM public.tours t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND t.creator_id = (select auth.uid())
    )
  );

ALTER POLICY "Authenticated users upload tour images" ON storage.objects
  WITH CHECK (
    bucket_id = 'tour-images'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

ALTER POLICY "Authenticated users update tour images" ON storage.objects
  USING (
    bucket_id = 'tour-images'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

ALTER POLICY "Authenticated users delete tour images" ON storage.objects
  USING (
    bucket_id = 'tour-images'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );
