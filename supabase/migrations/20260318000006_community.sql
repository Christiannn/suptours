-- Community Subjects table
CREATE TABLE public.community_subjects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
  body text NOT NULL CHECK (char_length(body) >= 10),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Subject Comments table
CREATE TABLE public.subject_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id uuid NOT NULL REFERENCES public.community_subjects(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 2000),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Community Flags table (any auth user can flag subjects or comments)
CREATE TABLE public.community_flags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type text NOT NULL CHECK (target_type IN ('subject', 'comment')),
  target_id uuid NOT NULL,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(target_type, target_id, reporter_id)
);

-- Enable RLS
ALTER TABLE public.community_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_flags ENABLE ROW LEVEL SECURITY;

-- community_subjects policies
CREATE POLICY "Anyone can read subjects" ON public.community_subjects
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create subjects" ON public.community_subjects
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = author_id);

CREATE POLICY "Authors can update own subjects" ON public.community_subjects
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete own subjects" ON public.community_subjects
  FOR DELETE USING (auth.uid() = author_id OR public.is_admin());

-- subject_comments policies
CREATE POLICY "Anyone can read comments" ON public.subject_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments" ON public.subject_comments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = author_id);

CREATE POLICY "Authors can delete own comments" ON public.subject_comments
  FOR DELETE USING (auth.uid() = author_id OR public.is_admin());

-- community_flags policies
CREATE POLICY "Authenticated users can flag" ON public.community_flags
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = reporter_id);

CREATE POLICY "Users can see own flags" ON public.community_flags
  FOR SELECT USING (auth.uid() = reporter_id OR public.is_admin());

CREATE POLICY "Admins can delete flags" ON public.community_flags
  FOR DELETE USING (public.is_admin());

-- Indexes for performance
CREATE INDEX idx_community_subjects_author ON public.community_subjects(author_id);
CREATE INDEX idx_community_subjects_created ON public.community_subjects(created_at DESC);
CREATE INDEX idx_subject_comments_subject ON public.subject_comments(subject_id);
CREATE INDEX idx_community_flags_target ON public.community_flags(target_type, target_id);
