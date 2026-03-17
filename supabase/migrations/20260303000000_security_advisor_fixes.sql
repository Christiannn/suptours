-- Security Advisor fixes:
-- 1) Set explicit search_path on SECURITY DEFINER functions.
-- 2) Replace permissive newsletter INSERT policy.

CREATE OR REPLACE FUNCTION public.user_has_team_role(
  p_team_id uuid,
  p_user_id uuid,
  p_min_level content_edit_level
)
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

  IF user_level IS NULL THEN
    RETURN false;
  END IF;

  level_order := CASE user_level WHEN 'read' THEN 1 WHEN 'edit' THEN 2 WHEN 'super' THEN 3 ELSE 0 END;
  min_order := CASE p_min_level WHEN 'read' THEN 1 WHEN 'edit' THEN 2 WHEN 'super' THEN 3 ELSE 0 END;

  RETURN level_order >= min_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.user_can_manage_team(p_team_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.teams t WHERE t.id = p_team_id AND t.created_by = p_user_id
  ) OR public.user_has_team_role(p_team_id, p_user_id, 'super');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', new.email));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_team()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.team_roles (team_id, name, description, content_edit_level)
  VALUES
    (new.id, 'participant', 'Read and comment', 'read'),
    (new.id, 'editor', 'Create, edit, delete own', 'edit'),
    (new.id, 'super', 'All permissions, delete any', 'super');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_team_creator_member()
RETURNS trigger AS $$
DECLARE
  super_role_id uuid;
BEGIN
  SELECT id INTO super_role_id
  FROM public.team_roles
  WHERE team_id = new.id AND content_edit_level = 'super'
  LIMIT 1;

  INSERT INTO public.team_members (team_id, user_id, role_id)
  VALUES (new.id, new.created_by, super_role_id);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe" ON public.newsletter_subscribers
  FOR INSERT
  WITH CHECK (
    team_id IS NULL
    AND email IS NOT NULL
    AND length(trim(email)) > 3
    AND position('@' in email) > 1
    AND (
      (auth.uid() IS NULL AND user_id IS NULL)
      OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
    )
  );
