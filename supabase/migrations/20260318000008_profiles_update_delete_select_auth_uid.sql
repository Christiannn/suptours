-- Supabase Performance Advisor fix:
-- Avoid per-row re-evaluation in RLS by wrapping auth.uid() in SELECT.

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;

CREATE POLICY "Users can delete own profile"
ON public.profiles
FOR DELETE
USING ((select auth.uid()) = id);
