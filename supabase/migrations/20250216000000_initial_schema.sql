-- Content edit level enum for team roles
CREATE TYPE content_edit_level AS ENUM ('read', 'edit', 'super');

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  country text,
  city text,
  display_name text,
  avatar_url text,
  updated_at timestamptz DEFAULT now()
);

-- Teams
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Team roles (per-team, created by team creator)
CREATE TABLE public.team_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  content_edit_level content_edit_level NOT NULL DEFAULT 'read',
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, name)
);

-- Team members
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.team_roles(id) ON DELETE RESTRICT,
  invited_email text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Blog posts
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL,
  content_md text,
  links jsonb DEFAULT '{}',
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  is_draft boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Slug unique per team when team_id is set, else unique per author
CREATE UNIQUE INDEX blog_posts_slug_team_unique ON public.blog_posts(team_id, slug) WHERE team_id IS NOT NULL;
CREATE UNIQUE INDEX blog_posts_slug_author_unique ON public.blog_posts(author_id, slug) WHERE team_id IS NULL;

-- Newsletter subscribers
CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Trigger: create profile on new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', new.email));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: create default team roles when team is created
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_team_created
  AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_team();

-- Trigger: add team creator as super member
CREATE OR REPLACE FUNCTION public.handle_team_creator_member()
RETURNS trigger AS $$
DECLARE
  super_role_id uuid;
BEGIN
  SELECT id INTO super_role_id FROM public.team_roles WHERE team_id = new.id AND content_edit_level = 'super' LIMIT 1;
  INSERT INTO public.team_members (team_id, user_id, role_id)
  VALUES (new.id, new.created_by, super_role_id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_team_creator_member
  AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.handle_team_creator_member();
