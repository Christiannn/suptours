import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	const today = new Date().toISOString().split('T')[0];

	// Fetch published tours from today onward
	const { data: tours, error } = await supabase
		.from('tours')
		.select(`
			id, title, description, image_url,
			start_date, start_time, end_date,
			locality, latitude, longitude,
			tags, source, status,
			max_participants, creator_id,
			responsible_person, contact_info, security_notes,
			parking_info, age_min, age_max,
			featured, view_count, external_url,
			created_at
		`)
		.eq('status', 'published')
		.gte('start_date', today)
		.order('start_date', { ascending: true })
		.order('start_time', { ascending: true });

	if (error) {
		console.error('Error loading tours:', error);
		return { tours: [], user };
	}

	// Get participant counts for all tours
	const tourIds = (tours ?? []).map(t => t.id);
	let participantCounts: Record<string, number> = {};
	let userJoined: Set<string> = new Set();

	if (tourIds.length > 0) {
		const { data: participants } = await supabase
			.from('tour_participants')
			.select('tour_id, user_id')
			.in('tour_id', tourIds);

		if (participants) {
			for (const p of participants) {
				participantCounts[p.tour_id] = (participantCounts[p.tour_id] ?? 0) + 1;
				if (user && p.user_id === user.id) {
					userJoined.add(p.tour_id);
				}
			}
		}
	}

	// Get creator profiles for display names
	const creatorIds = [...new Set((tours ?? []).map(t => t.creator_id))];
	let creatorProfiles: Record<string, { display_name: string | null; avatar_url: string | null }> = {};

	if (creatorIds.length > 0) {
		const { data: profiles } = await supabase
			.from('profiles')
			.select('id, display_name, avatar_url')
			.in('id', creatorIds);

		if (profiles) {
			for (const p of profiles) {
				creatorProfiles[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
			}
		}
	}

	const enrichedTours = (tours ?? []).map(t => ({
		...t,
		participant_count: participantCounts[t.id] ?? 0,
		has_joined: userJoined.has(t.id),
		creator_name: creatorProfiles[t.creator_id]?.display_name ?? null,
		creator_avatar: creatorProfiles[t.creator_id]?.avatar_url ?? null
	}));

	return { tours: enrichedTours, user };
}) satisfies PageServerLoad;

export const actions = {
	join: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { message: 'Must be logged in' });

		const formData = await request.formData();
		const tour_id = formData.get('tour_id') as string;

		if (!tour_id) return fail(400, { message: 'Tour ID required' });

		const { error } = await supabase
			.from('tour_participants')
			.insert({ tour_id, user_id: user.id });

		if (error) {
			if (error.code === '23505') {
				return fail(400, { message: 'Already joined' });
			}
			console.error('[tours/join] Supabase error:', error);
			return fail(500, { message: error.message });
		}

		return { success: true };
	},

	leave: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { message: 'Must be logged in' });

		const formData = await request.formData();
		const tour_id = formData.get('tour_id') as string;

		if (!tour_id) return fail(400, { message: 'Tour ID required' });

		const { error } = await supabase
			.from('tour_participants')
			.delete()
			.eq('tour_id', tour_id)
			.eq('user_id', user.id);

		if (error) {
			console.error('[tours/leave] Supabase error:', error);
			return fail(500, { message: error.message });
		}

		return { success: true };
	}
} satisfies Actions;
