import { requireUser } from '$lib/auth/requireUser';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load = (async (event) => {
	const { user } = await requireUser(event);
	const { supabase } = event.locals;
	const { id } = event.params;

	const [subjectResult, commentsResult, flagsResult] = await Promise.all([
		supabase
			.from('community_subjects')
			.select(`
				id, title, body, tags, created_at, updated_at, author_id,
				profiles!community_subjects_author_id_fkey(display_name, avatar_url)
			`)
			.eq('id', id)
			.single(),

		supabase
			.from('subject_comments')
			.select(`
				id, body, created_at, author_id,
				profiles!subject_comments_author_id_fkey(display_name, avatar_url)
			`)
			.eq('subject_id', id)
			.order('created_at', { ascending: true }),

		// Load user's own flags so they know what they've flagged
		supabase
			.from('community_flags')
			.select('target_type, target_id')
			.eq('reporter_id', user.id)
	]);

	if (subjectResult.error || !subjectResult.data) {
		error(404, 'Subject not found');
	}

	const myFlags = new Set(
		(flagsResult.data ?? []).map(f => `${f.target_type}:${f.target_id}`)
	);

	return {
		subject: subjectResult.data,
		comments: commentsResult.data ?? [],
		myFlags,
		userId: user.id
	};
}) satisfies PageServerLoad;

export const actions = {
	addComment: async (event) => {
		const { user } = await requireUser(event);
		const { request, locals: { supabase }, params } = event;
		const formData = await request.formData();
		const body = String(formData.get('body') ?? '').trim();

		if (!body || body.length < 1) {
			return fail(400, { commentError: 'Comment cannot be empty.' });
		}
		if (body.length > 2000) {
			return fail(400, { commentError: 'Comment is too long (max 2000 characters).' });
		}

		const { error: err } = await supabase
			.from('subject_comments')
			.insert({ subject_id: params.id, author_id: user.id, body });

		if (err) {
			return fail(500, { commentError: 'Could not post comment.' });
		}

		return { commentSuccess: true };
	},

	deleteComment: async (event) => {
		const { user } = await requireUser(event);
		const { request, locals: { supabase } } = event;
		const formData = await request.formData();
		const commentId = String(formData.get('comment_id') ?? '').trim();

		if (!commentId) return fail(400, { error: 'Missing comment id.' });

		// RLS handles authorization (owner or admin can delete)
		const { error: err } = await supabase
			.from('subject_comments')
			.delete()
			.eq('id', commentId);

		if (err) return fail(500, { error: 'Could not delete comment.' });
		return { deleteSuccess: true };
	},

	deleteSubject: async (event) => {
		const { user } = await requireUser(event);
		const { locals: { supabase }, params } = event;

		const { error: err } = await supabase
			.from('community_subjects')
			.delete()
			.eq('id', params.id);

		if (err) return fail(500, { error: 'Could not delete subject.' });

		return { deleteSubjectSuccess: true };
	},

	flag: async (event) => {
		const { user } = await requireUser(event);
		const { request, locals: { supabase } } = event;
		const formData = await request.formData();
		const targetType = String(formData.get('target_type') ?? '');
		const targetId = String(formData.get('target_id') ?? '');

		if (!['subject', 'comment'].includes(targetType) || !targetId) {
			return fail(400, { error: 'Invalid flag target.' });
		}

		const { error: err } = await supabase
			.from('community_flags')
			.insert({ target_type: targetType, target_id: targetId, reporter_id: user.id });

		if (err?.code === '23505') {
			// Already flagged — silently ok
			return { flagSuccess: true };
		}
		if (err) return fail(500, { error: 'Could not flag.' });

		return { flagSuccess: true };
	}
} satisfies Actions;
