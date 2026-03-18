import { requireUser } from '$lib/auth/requireUser';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const slugify = (value: string) =>
	value
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');

const parseReturnTarget = (value: string | null | undefined) => {
	const next = (value ?? '').trim();
	if (next === '/blog') {
		return { path: '/blog' as const, isList: true, slug: null as string | null };
	}

	const match = next.match(/^\/blog\/([a-z0-9-]+)$/);
	if (match) {
		return { path: next, isList: false, slug: match[1] };
	}

	return { path: null, isList: false, slug: null as string | null };
};

export const load = (async (event) => {
	const { user } = await requireUser(event);
	const { params, locals: { supabase }, url, request } = event;

	const { data: post, error: err } = await supabase
		.from('blog_posts')
		.select('*')
		.eq('slug', params.slug)
		.is('team_id', null)
		.single();

	if (err || !post) {
		error(404, 'Post not found');
	}

	const fromQuery = parseReturnTarget(url.searchParams.get('next'));
	let returnPath = fromQuery.path;
	let returnIsList = fromQuery.isList;
	let returnSlug = fromQuery.slug;

	if (!returnPath) {
		const refererHeader = request.headers.get('referer');
		if (refererHeader) {
			try {
				const refererUrl = new URL(refererHeader);
				if (refererUrl.origin === url.origin) {
					const refererTarget = parseReturnTarget(refererUrl.pathname);
					returnPath = refererTarget.path;
					returnIsList = refererTarget.isList;
					returnSlug = refererTarget.slug;
				}
			} catch {
				// Ignore invalid referer header
			}
		}
	}

	return {
		post,
		returnPath,
		returnIsList,
		returnSlug
	};
}) satisfies PageServerLoad;

export const actions = {
	save: async (event) => {
		const { request, params, locals: { supabase } } = event;
		const { user } = await requireUser(event);
		const formData = await request.formData();

		const title = (formData.get('title') as string)?.trim();
		const rawSlug = (formData.get('slug') as string)?.trim();
		const slug = rawSlug ? slugify(rawSlug) : '';
		const content_md = (formData.get('content_md') as string)?.trim() ?? '';
		const next = parseReturnTarget((formData.get('next') as string) ?? null);

		if (!title || !slug) {
			return fail(400, { message: 'Title and a valid slug are required.' });
		}

		const { data: existing } = await supabase
			.from('blog_posts')
			.select('id')
			.eq('slug', params.slug)
			.is('team_id', null)
			.single();

		if (!existing) {
			return fail(404, { message: 'Post not found.' });
		}

		const { error: updateError } = await supabase
			.from('blog_posts')
			.update({
				title,
				slug,
				content_md: content_md || null,
				updated_at: new Date().toISOString()
			})
			.eq('id', existing.id);

		if (updateError) {
			if (updateError.code === '23505') {
				return fail(409, { message: 'A post with this slug already exists.' });
			}
			return fail(500, { message: 'Could not save post. Please try again.' });
		}

		redirect(303, next.path ?? `/blog/${slug}`);
	},
	delete: async (event) => {
		const { params, locals: { supabase } } = event;
		const { user } = await requireUser(event);

		const { data: existing } = await supabase
			.from('blog_posts')
			.select('id')
			.eq('slug', params.slug)
			.is('team_id', null)
			.single();

		if (!existing) {
			return fail(404, { message: 'Post not found.' });
		}

		const { error: deleteError } = await supabase.from('blog_posts').delete().eq('id', existing.id);

		if (deleteError) {
			return fail(500, { message: 'Could not delete post. Please try again.' });
		}

		redirect(303, '/blog');
	}
} satisfies Actions;
