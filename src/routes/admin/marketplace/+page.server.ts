import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function parseCsvList(raw: FormDataEntryValue | null): string[] {
	return String(raw ?? '')
		.split(',')
		.map((v) => v.trim())
		.filter(Boolean);
}

export const load = (async ({ locals: { supabase } }) => {
	const { data: products, error } = await supabase
		.from('marketplace_products')
		.select('id, name, url, tags, address, price_label, contact_info, image_urls, is_active, created_at')
		.order('created_at', { ascending: false });

	if (error) {
		console.error('[admin/marketplace] load failed', error);
		return { products: [] };
	}

	return { products: products ?? [] };
}) satisfies PageServerLoad;

export const actions = {
	createProduct: async ({ request, locals: { supabase } }) => {
		const fd = await request.formData();
		const name = String(fd.get('name') ?? '').trim();
		const url = String(fd.get('url') ?? '').trim();

		if (!name || !url) {
			return fail(400, { error: 'Navn og URL er påkrævet.' });
		}

		const { error } = await supabase.from('marketplace_products').insert({
			name,
			url,
			tags: parseCsvList(fd.get('tags')),
			address: String(fd.get('address') ?? '').trim() || null,
			price_label: String(fd.get('price_label') ?? '').trim() || null,
			contact_info: String(fd.get('contact_info') ?? '').trim() || null,
			image_urls: parseCsvList(fd.get('image_urls')),
			is_active: fd.get('is_active') === 'on',
		});

		if (error) {
			return fail(500, { error: error.message });
		}

		return { success: true };
	},

	updateProduct: async ({ request, locals: { supabase } }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		const name = String(fd.get('name') ?? '').trim();
		const url = String(fd.get('url') ?? '').trim();

		if (!id || !name || !url) {
			return fail(400, { error: 'id, navn og URL er påkrævet.' });
		}

		const { error } = await supabase
			.from('marketplace_products')
			.update({
				name,
				url,
				tags: parseCsvList(fd.get('tags')),
				address: String(fd.get('address') ?? '').trim() || null,
				price_label: String(fd.get('price_label') ?? '').trim() || null,
				contact_info: String(fd.get('contact_info') ?? '').trim() || null,
				image_urls: parseCsvList(fd.get('image_urls')),
				is_active: fd.get('is_active') === 'on',
			})
			.eq('id', id);

		if (error) {
			return fail(500, { error: error.message });
		}

		return { success: true };
	},

	deleteProduct: async ({ request, locals: { supabase } }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		if (!id) return fail(400, { error: 'id mangler.' });

		const { error } = await supabase.from('marketplace_products').delete().eq('id', id);
		if (error) {
			return fail(500, { error: error.message });
		}
		return { success: true };
	},
} satisfies Actions;
