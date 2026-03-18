import { requireUser } from '$lib/auth/requireUser';
import type { PageServerLoad } from './$types';

export const load = (async (event) => {
	const { user } = await requireUser(event);
	const { locals: { supabase } } = event;

	const { data: posts, error: err } = await supabase
		.from('blog_posts')
		.select('id, title, slug, created_at, updated_at')
		.eq('author_id', user.id)
		.is('team_id', null)
		.order('updated_at', { ascending: false, nullsFirst: false })
		.order('created_at', { ascending: false });

	return {
		posts: posts ?? [],
		loadError: err?.message ?? null
	};
}) satisfies PageServerLoad;
