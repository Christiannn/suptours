import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load = (async (event) => {
	// Admin protection is enforced by hooks.server.ts for all /admin routes
	const { supabase } = event.locals;

	const [subjectsResult, flagsResult] = await Promise.all([
		supabase
			.from('community_subjects')
			.select(`
				id, title, body, tags, created_at, author_id,
				profiles!community_subjects_author_id_fkey(display_name),
				subject_comments(id, body, created_at, author_id,
					profiles!subject_comments_author_id_fkey(display_name)
				)
			`)
			.order('created_at', { ascending: false }),

		supabase
			.from('community_flags')
			.select('id, target_type, target_id, created_at, reporter_id, profiles!community_flags_reporter_id_fkey(display_name)')
			.order('created_at', { ascending: false })
	]);

	// Build a map of flag counts per target
	const flagCounts = new Map<string, number>();
	for (const flag of (flagsResult.data ?? [])) {
		const key = `${flag.target_type}:${flag.target_id}`;
		flagCounts.set(key, (flagCounts.get(key) ?? 0) + 1);
	}

	return {
		subjects: subjectsResult.data ?? [],
		flags: flagsResult.data ?? [],
		flagCounts: Object.fromEntries(flagCounts)
	};
}) satisfies PageServerLoad;

export const actions = {
	deleteSubject: async (event) => {
		// Admin protection handled by hooks.server.ts
		const { request, locals: { supabase } } = event;
		const formData = await request.formData();
		const subjectId = String(formData.get('subject_id') ?? '').trim();

		if (!subjectId) return fail(400, { error: 'Missing subject id.' });

		const { error: err } = await supabase
			.from('community_subjects')
			.delete()
			.eq('id', subjectId);

		if (err) return fail(500, { error: 'Could not delete subject.' });
		return { success: true, action: 'deleteSubject' };
	},

	deleteComment: async (event) => {
		// Admin protection handled by hooks.server.ts
		const { request, locals: { supabase } } = event;
		const formData = await request.formData();
		const commentId = String(formData.get('comment_id') ?? '').trim();

		if (!commentId) return fail(400, { error: 'Missing comment id.' });

		const { error: err } = await supabase
			.from('subject_comments')
			.delete()
			.eq('id', commentId);

		if (err) return fail(500, { error: 'Could not delete comment.' });
		return { success: true, action: 'deleteComment' };
	},

	dismissFlag: async (event) => {
		// Admin protection handled by hooks.server.ts
		const { request, locals: { supabase } } = event;
		const formData = await request.formData();
		const flagId = String(formData.get('flag_id') ?? '').trim();

		if (!flagId) return fail(400, { error: 'Missing flag id.' });

		const { error: err } = await supabase
			.from('community_flags')
			.delete()
			.eq('id', flagId);

		if (err) return fail(500, { error: 'Could not dismiss flag.' });
		return { success: true, action: 'dismissFlag' };
	}
} satisfies Actions;
