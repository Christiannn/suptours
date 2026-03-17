import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '$lib/auth/requireUser';

export const load = (async (event) => {
	const { user } = await requireUser(event);
	return { user };
}) satisfies PageServerLoad;

export const actions = {
	create: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { message: 'Must be logged in' });

		const fd = await request.formData();

		const title = (fd.get('title') as string)?.trim();
		const description = (fd.get('description') as string)?.trim() || null;
		const start_date = fd.get('start_date') as string;
		const start_time = (fd.get('start_time') as string) || null;
		const end_date = (fd.get('end_date') as string) || null;
		const locality = (fd.get('locality') as string)?.trim() || null;
		const parking_info = (fd.get('parking_info') as string)?.trim() || null;
		const max_participants = fd.get('max_participants') ? parseInt(fd.get('max_participants') as string) : null;
		const age_min = fd.get('age_min') ? parseInt(fd.get('age_min') as string) : 0;
		const age_max = fd.get('age_max') ? parseInt(fd.get('age_max') as string) : 120;
		const security_notes = (fd.get('security_notes') as string)?.trim() || null;
		const responsible_person = (fd.get('responsible_person') as string)?.trim() || null;
		const contact_info = (fd.get('contact_info') as string)?.trim() || null;
		const image_url = (fd.get('image_url') as string)?.trim() || null;
		const tags = fd.getAll('tags') as string[];
		const action = fd.get('action') as string; // 'draft' or 'publish'

		// Validation
		if (!title) return fail(400, { message: 'Title is required' });
		if (!start_date) return fail(400, { message: 'Start date is required' });

		const status = action === 'publish' ? 'published' : 'draft';

		const { data: tour, error } = await supabase
			.from('tours')
			.insert({
				creator_id: user.id,
				title,
				description,
				start_date,
				start_time,
				end_date,
				locality,
				parking_info,
				max_participants,
				age_min,
				age_max,
				security_notes,
				responsible_person,
				contact_info,
				image_url,
				tags,
				status,
				source: 'user'
			})
			.select('id')
			.single();

		if (error) {
			return fail(500, { message: error.message });
		}

		if (status === 'published') {
			redirect(303, '/tours');
		} else {
			redirect(303, '/profile');
		}
	}
} satisfies Actions;
