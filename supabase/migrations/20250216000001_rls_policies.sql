-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is team member with given content_edit_level or higher
CREATE OR REPLACE FUNCTION public.user_has_team_role(p_team_id uuid, p_user_id uuid, p_min_level content_edit_level)
RETURNS boolean AS $$
DECLARE
  user_level content_edit_level;
  level_order int;
  min_order int;
BEGIN
  SELECT tr.content_edit_level INTO user_level
  FROM public.team_members tm
  JOIN public.team_roles tr ON tr.id = tm.role_id
  WHERE tm.team_id = p_team_id AND tm.user_id = p_user_id;
  
  IF user_level IS NULL THEN RETURN false; END IF;
  
  level_order := CASE user_level WHEN 'read' THEN 1 WHEN 'edit' THEN 2 WHEN 'super' THEN 3 ELSE 0 END;
  min_order := CASE p_min_level WHEN 'read' THEN 1 WHEN 'edit' THEN 2 WHEN 'super' THEN 3 ELSE 0 END;
  
  RETURN level_order >= min_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: check if user is team creator or has super role
CREATE OR REPLACE FUNCTION public.user_can_manage_team(p_team_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.teams t WHERE t.id = p_team_id AND t.created_by = p_user_id
  ) OR public.user_has_team_role(p_team_id, p_user_id, 'super');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- TEAMS
CREATE POLICY "Team members can view team" ON public.teams FOR SELECT
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.team_members WHERE team_id = id AND user_id = auth.uid())
  );
CREATE POLICY "Authenticated users can create team" ON public.teams FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator or super can update team" ON public.teams FOR UPDATE
  USING (public.user_can_manage_team(id, auth.uid()));
CREATE POLICY "Creator or super can delete team" ON public.teams FOR DELETE
  USING (public.user_can_manage_team(id, auth.uid()));

-- TEAM_ROLES
CREATE POLICY "Team members can view roles" ON public.team_roles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.team_members WHERE team_id = team_roles.team_id AND user_id = auth.uid())
  );
CREATE POLICY "Creator or super can insert roles" ON public.team_roles FOR INSERT
  WITH CHECK (public.user_can_manage_team(team_id, auth.uid()));
CREATE POLICY "Creator or super can update roles" ON public.team_roles FOR UPDATE
  USING (public.user_can_manage_team(team_id, auth.uid()));
CREATE POLICY "Creator or super can delete roles" ON public.team_roles FOR DELETE
  USING (public.user_can_manage_team(team_id, auth.uid()));

-- TEAM_MEMBERS
CREATE POLICY "Team members can view members" ON public.team_members FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid())
  );
CREATE POLICY "Creator or super can add members" ON public.team_members FOR INSERT
  WITH CHECK (public.user_can_manage_team(team_id, auth.uid()));
CREATE POLICY "Creator or super can update members" ON public.team_members FOR UPDATE
  USING (public.user_can_manage_team(team_id, auth.uid()));
CREATE POLICY "Creator or super can delete members" ON public.team_members FOR DELETE
  USING (public.user_can_manage_team(team_id, auth.uid()));

-- BLOG_POSTS
-- SELECT: public read when team_id IS NULL; when team_id IS NOT NULL only team members; author always sees own
CREATE POLICY "Blog posts select" ON public.blog_posts FOR SELECT
  USING (
    author_id = auth.uid() OR
    (team_id IS NULL AND is_draft = false) OR
    (team_id IS NOT NULL AND is_draft = false AND EXISTS (
      SELECT 1 FROM public.team_members WHERE team_id = blog_posts.team_id AND user_id = auth.uid()
    )) OR
    (team_id IS NOT NULL AND is_draft = true AND EXISTS (
      SELECT 1 FROM public.team_members WHERE team_id = blog_posts.team_id AND user_id = auth.uid()
    ))
  );
CREATE POLICY "Authenticated can create post" ON public.blog_posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Author or editor/super can update" ON public.blog_posts FOR UPDATE
  USING (
    author_id = auth.uid() OR
    (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), 'edit'))
  );
CREATE POLICY "Author or edit/super can delete own; super can delete any" ON public.blog_posts FOR DELETE
  USING (
    author_id = auth.uid() OR
    (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), 'edit'))
  );

-- NEWSLETTER_SUBSCRIBERS
CREATE POLICY "Anyone can subscribe" ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view own subscriptions" ON public.newsletter_subscribers FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);
