-- Helper function to check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update Blog Posts policies to include admin access ONLY
DROP POLICY IF EXISTS "Authenticated can create post" ON public.blog_posts;
CREATE POLICY "Admins can create post" ON public.blog_posts 
  FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Author or editor/super can update" ON public.blog_posts;
CREATE POLICY "Admins can update posts" ON public.blog_posts 
  FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Author or edit/super can delete own; super can delete any" ON public.blog_posts;
CREATE POLICY "Admins can delete posts" ON public.blog_posts 
  FOR DELETE
  USING (public.is_admin());
