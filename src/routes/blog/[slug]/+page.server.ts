import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { formatBlogMarkdown } from '$lib/blog/markdownFormatter.server';

export const load = (async ({ params, locals: { supabase, safeGetSession } }) => {
	const { slug } = params;
	const { user } = await safeGetSession();

	const { data: post, error: err } = await supabase
		.from('blog_posts')
		.select('*, profiles(display_name, name)')
		.eq('slug', slug)
		.is('team_id', null)
		.eq('is_draft', false)
		.single();

	if (err || !post) {
		error(404, 'Post not found');
	}

	const content_blocks = await formatBlogMarkdown(post.content_md);

	const { data: profile } = user
		? await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
		: { data: null };

	const content_blocks = await formatBlogMarkdown(post.content_md);

	return {
		post: { ...post, content_blocks },
		user,
		canEdit: Boolean(user && profile?.is_admin)
	};
}) satisfies PageServerLoad;
