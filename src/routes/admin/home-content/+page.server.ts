import { requireUser } from '$lib/auth/requireUser';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const SITE_ASSETS_BUCKET = 'site-assets';
const HOME_TRUST_KEY = 'home_trust_image_url';

function sanitizeFileName(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
}

function extractPathFromPublicUrl(url: string): string | null {
	const marker = `/storage/v1/object/public/${SITE_ASSETS_BUCKET}/`;
	const idx = url.indexOf(marker);
	if (idx === -1) return null;
	return decodeURIComponent(url.slice(idx + marker.length));
}

export const load = (async ({ locals: { supabase } }) => {
	const { data: row } = await supabase
		.from('site_settings')
		.select('value, updated_at')
		.eq('key', HOME_TRUST_KEY)
		.maybeSingle();

	return {
		homeTrustImageUrl: row?.value?.trim() ? row.value : null,
		homeTrustUpdatedAt: row?.updated_at ?? null
	};
}) satisfies PageServerLoad;

export const actions = {
	uploadHomeTrustImage: async (event) => {
		const { request, locals: { supabase } } = event;
		await requireUser(event);
		const formData = await request.formData();
		const file = formData.get('image_file');

		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { message: 'Choose an image file.' });
		}

		const fileName = sanitizeFileName(file.name || 'image.jpg');
		const filePath = `home-trust/${Date.now()}-${fileName}`;

		const { error: uploadError } = await supabase.storage.from(SITE_ASSETS_BUCKET).upload(filePath, file, {
			cacheControl: '3600',
			upsert: false,
			contentType: file.type || 'image/jpeg'
		});

		if (uploadError) {
			return fail(500, { message: uploadError.message || 'Upload failed.' });
		}

		const { data: publicUrlData } = supabase.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(filePath);
		const imageUrl = publicUrlData.publicUrl;

		const { error: upsertError } = await supabase.from('site_settings').upsert(
			{
				key: HOME_TRUST_KEY,
				value: imageUrl,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'key' }
		);

		if (upsertError) {
			return fail(500, { message: 'Saved file but could not update site settings.' });
		}

		return { message: 'Home section image updated.', success: true };
	},

	clearHomeTrustImage: async (event) => {
		const { locals: { supabase } } = event;
		await requireUser(event);

		const { data: row } = await supabase
			.from('site_settings')
			.select('value')
			.eq('key', HOME_TRUST_KEY)
			.maybeSingle();

		const oldUrl = row?.value?.trim();
		if (oldUrl) {
			const path = extractPathFromPublicUrl(oldUrl);
			if (path) {
				await supabase.storage.from(SITE_ASSETS_BUCKET).remove([path]);
			}
		}

		const { error } = await supabase.from('site_settings').delete().eq('key', HOME_TRUST_KEY);
		if (error) {
			return fail(500, { message: error.message });
		}

		return { message: 'Image removed.', success: true };
	}
} satisfies Actions;
