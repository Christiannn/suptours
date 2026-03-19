import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const { data: tour, error: tourError } = await supabase
		.from('tours')
		.select('*')
		.eq('id', params.id)
		.single();

	if (tourError || !tour) {
		error(404, 'Tour not found');
	}

	// Only published tours are visible to non-creators
	if (tour.status !== 'published' && (!user || tour.creator_id !== user.id)) {
		error(404, 'Tour not found');
	}

	// Increment view count (fire and forget)
	await supabase
		.from('tours')
		.update({ view_count: tour.view_count + 1 })
		.eq('id', tour.id);

	// Get participants
	const { data: participants } = await supabase
		.from('tour_participants')
		.select('user_id, joined_at')
		.eq('tour_id', tour.id);

	const participantUserIds = (participants ?? []).map(p => p.user_id);

	let participantProfiles: { id: string; display_name: string | null; avatar_url: string | null }[] = [];
	if (participantUserIds.length > 0) {
		const { data: profiles } = await supabase
			.from('profiles')
			.select('id, display_name, avatar_url')
			.in('id', participantUserIds);
		participantProfiles = profiles ?? [];
	}

	// Creator profile
	const { data: creatorProfile } = await supabase
		.from('profiles')
		.select('display_name, avatar_url')
		.eq('id', tour.creator_id)
		.single();

	const has_joined = user ? participantUserIds.includes(user.id) : false;

	return {
		tour: {
			...tour,
			participant_count: participants?.length ?? 0,
			has_joined,
			creator_name: creatorProfile?.display_name ?? null,
			creator_avatar: creatorProfile?.avatar_url ?? null
		},
		participantProfiles,
		user
	};
}) satisfies PageServerLoad;

export const actions = {
	join: async ({ request, params, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { message: 'Must be logged in' });

		const { error } = await supabase
			.from('tour_participants')
			.insert({ tour_id: params.id, user_id: user.id });

		if (error) {
			if (error.code === '23505') return fail(400, { message: 'Already joined' });
			console.error('[tour/join] Supabase error:', error);
			return fail(500, { message: error.message });
		}
		return { success: true };
	},

	leave: async ({ params, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { message: 'Must be logged in' });

		const { error } = await supabase
			.from('tour_participants')
			.delete()
			.eq('tour_id', params.id)
			.eq('user_id', user.id);

		if (error) {
			console.error('[tour/leave] Supabase error:', error);
			return fail(500, { message: error.message });
		}
		return { success: true };
	}
} satisfies Actions;
