-- Supabase Performance Advisor fix:
-- Avoid per-row re-evaluation in RLS by wrapping auth.uid() in SELECT.

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK ((select auth.uid()) = id);
