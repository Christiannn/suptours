import { requireUser } from '$lib/auth/requireUser';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load = (async (event) => {
	await requireUser(event);
	const { supabase } = event.locals;

	const { data: subjects, error } = await supabase
		.from('community_subjects')
		.select(`
			id,
			title,
			body,
			tags,
			created_at,
			author_id,
			profiles!community_subjects_author_id_fkey(display_name, avatar_url),
			subject_comments(count)
		`)
		.order('created_at', { ascending: false });

	if (error) {
		return { subjects: [] };
	}

	return {
		subjects: subjects ?? []
	};
}) satisfies PageServerLoad;

export const actions = {
	createSubject: async (event) => {
		const { user } = await requireUser(event);
		const { request, locals: { supabase } } = event;
		const formData = await request.formData();

		const title = String(formData.get('title') ?? '').trim();
		const body = String(formData.get('body') ?? '').trim();
		const tagsRaw = String(formData.get('tags') ?? '').trim();
		const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

		if (!title || title.length < 3) {
			return fail(400, { error: 'Title must be at least 3 characters.' });
		}
		if (!body || body.length < 10) {
			return fail(400, { error: 'Body must be at least 10 characters.' });
		}

		const { error } = await supabase
			.from('community_subjects')
			.insert({ title, body, tags, author_id: user.id });

		if (error) {
			return fail(500, { error: 'Could not create subject.' });
		}

		return { success: true };
	}
} satisfies Actions;
