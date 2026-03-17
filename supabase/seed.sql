-- Seed data for development (run only when seeding)
-- Requires at least one auth user to exist; run after first user signs up or use Supabase dashboard to create test user

-- Security hardening guardrails (keep these in future migrations):
-- 1) SECURITY DEFINER functions should always include `SET search_path = public`.
-- 2) Avoid permissive RLS checks like `WITH CHECK (true)` for INSERT/UPDATE/DELETE.
--    Use explicit constraints (auth context, ownership, and field validation) instead.

-- Note: In dev, you may need to manually create a test user via Supabase Auth UI
-- or run: supabase auth signup --email test@example.com --password test123
-- Then replace the UUID below with the actual user id from auth.users

-- Example: Insert sample blog posts (uncomment and set author_id after first user exists)
-- INSERT INTO public.blog_posts (title, slug, content_md, author_id, is_draft)
-- SELECT 'Welcome Post', 'welcome-post', '# Hello\n\nThis is the first post.', id, false
-- FROM public.profiles LIMIT 1;
