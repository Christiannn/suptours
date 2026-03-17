import type { PageServerLoad } from './$types';

export const load = (async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	// Public posts: team_id IS NULL, is_draft = false
	const { data: posts } = await supabase
		.from('blog_posts')
		.select('id, title, slug, created_at, author_id, profiles(display_name)')
		.is('team_id', null)
		.eq('is_draft', false)
		.order('created_at', { ascending: false });

	return { posts: posts ?? [], user };
}) satisfies PageServerLoad;
