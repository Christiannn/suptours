import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) throw redirect(303, '/login');

	const { data: tour, error: tourError } = await supabase
		.from('tours')
		.select('*')
		.eq('id', params.id)
		.single();

	if (tourError || !tour) {
		throw error(404, 'Tour not found');
	}

	if (tour.creator_id !== user.id) {
		throw error(403, 'You are not authorized to edit this tour');
	}

	return { tour };
}) satisfies PageServerLoad;

export const actions = {
	update: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { message: 'Must be logged in' });

		const formData = await request.formData();
		const action = formData.get('action') as string; // 'draft' or 'publish'
		
		const title = formData.get('title') as string;
		const description = formData.get('description') as string;
		const tags = formData.getAll('tags') as string[];
		const start_date = formData.get('start_date') as string;
		const start_time = formData.get('start_time') as string;
		const end_date = formData.get('end_date') as string;
		const locality = formData.get('locality') as string;
		const parking_info = formData.get('parking_info') as string;
		const max_participants = formData.get('max_participants') as string;
		const age_min = formData.get('age_min') as string;
		const age_max = formData.get('age_max') as string;
		const security_notes = formData.get('security_notes') as string;
		const responsible_person = formData.get('responsible_person') as string;
		const contact_info = formData.get('contact_info') as string;
		const image_url = formData.get('image_url') as string;

		if (!title) return fail(400, { message: 'Title is required' });
		if (!start_date) return fail(400, { message: 'Start date is required' });

		const { error: updateError } = await supabase
			.from('tours')
			.update({
				title,
				description,
				tags,
				start_date,
				start_time: start_time || null,
				end_date: end_date || null,
				locality,
				parking_info,
				max_participants: max_participants ? parseInt(max_participants) : null,
				age_min: parseInt(age_min) || 0,
				age_max: parseInt(age_max) || 120,
				security_notes,
				responsible_person,
				contact_info,
				image_url,
				status: action === 'publish' ? 'published' : 'draft',
				updated_at: new Date().toISOString()
			})
			.eq('id', params.id)
			.eq('creator_id', user.id);

		if (updateError) {
			console.error('[tour/update] Supabase error:', updateError);
			return fail(500, { message: updateError.message });
		}

		throw redirect(303, `/tours`);
	}
} satisfies Actions;
