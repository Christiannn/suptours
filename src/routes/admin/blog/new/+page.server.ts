import { requireUser } from '$lib/auth/requireUser';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const slugify = (value: string) =>
	value
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');

export const load = (async (event) => {
	await requireUser(event);
	return {};
}) satisfies PageServerLoad;

export const actions = {
	default: async (event) => {
		const { request, locals: { supabase } } = event;
		const { user } = await requireUser(event);
		const formData = await request.formData();

		const title = (formData.get('title') as string)?.trim();
		const rawSlug = (formData.get('slug') as string)?.trim();
		const slug = rawSlug ? slugify(rawSlug) : '';
		const content_md = (formData.get('content_md') as string)?.trim() ?? '';

		if (!title || !slug) {
			return fail(400, { message: 'Title and a valid slug are required.' });
		}

		const { data: post, error } = await supabase
			.from('blog_posts')
			.insert({
				title,
				slug,
				content_md: content_md || null,
				author_id: user.id,
				team_id: null,
				is_draft: false
			})
			.select('slug')
			.single();

		if (error) {
			if (error.code === '23505') {
				return fail(409, { message: 'A post with this slug already exists.' });
			}
			return fail(500, { message: 'Could not create post. Please try again.' });
		}

		redirect(303, `/blog/${post.slug}`);
	}
} satisfies Actions;
