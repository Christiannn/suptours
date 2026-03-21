import { requireUser } from '$lib/auth/requireUser';
import { fail, redirect } from '@sveltejs/kit';
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
		const avatarFile = formData.get('avatar_file');
		let avatar_url: string | null = null;

		if (avatarFile instanceof File && avatarFile.size > 0) {
			if (!avatarFile.type.startsWith('image/')) {
				return fail(400, { message: 'Avatar file must be an image.' });
			}
			if (avatarFile.size > 3 * 1024 * 1024) {
				return fail(400, { message: 'Avatar image must be 3MB or smaller.' });
			}

			const path = `${user.id}/avatar`;
			const fileBytes = new Uint8Array(await avatarFile.arrayBuffer());
			const { error: uploadError } = await supabase.storage
				.from('avatars')
				.upload(path, fileBytes, {
					upsert: true,
					contentType: avatarFile.type || 'image/jpeg'
				});

			if (uploadError) {
				return fail(500, { message: uploadError.message });
			}

			const { data: publicUrlData } = supabase.storage
				.from('avatars')
				.getPublicUrl(path);
			avatar_url = publicUrlData.publicUrl;
		}

		const { error } = await supabase
			.from('profiles')
			.upsert(
				{
					id: user.id,
					display_name: display_name || null,
					name: name || null,
					country: country || null,
					city: city || null,
					...(avatar_url ? { avatar_url } : {}),
					updated_at: new Date().toISOString()
				},
				{ onConflict: 'id' }
			);

		if (error) {
			return fail(500, { message: error.message });
		}

		throw redirect(303, '/profile');
	}
} satisfies Actions;
