import { requireUser } from '$lib/auth/requireUser';
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load = (async (event) => {
	const { user } = await requireUser(event);
	const { supabase } = event.locals;

	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', user.id)
		.single();

	return { user, profile: profile ?? null };
}) satisfies PageServerLoad;

export const actions = {
	default: async (event) => {
		const { request, locals: { supabase } } = event;
		const { user } = await requireUser(event);
		const formData = await request.formData();

		const display_name = (formData.get('display_name') as string) ?? null;
		const name = (formData.get('name') as string) ?? null;
		const country = (formData.get('country') as string) ?? null;
		const city = (formData.get('city') as string) ?? null;
		const avatar_url = (formData.get('avatar_url') as string) ?? null;

		const { error } = await supabase
			.from('profiles')
			.upsert(
				{
					id: user.id,
					display_name: display_name || null,
					name: name || null,
					country: country || null,
					city: city || null,
					avatar_url: avatar_url || null,
					updated_at: new Date().toISOString()
				},
				{ onConflict: 'id' }
			);

		if (error) {
			return { message: error.message };
		}

		redirect(303, '/profile');
	}
} satisfies Actions;
