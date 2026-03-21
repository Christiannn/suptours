import type { PageServerLoad } from './$types';

export const load = (async ({ locals: { supabase } }) => {
	const { data: products, error } = await supabase
		.from('marketplace_products')
		.select('id, name, url, tags, address, price_label, contact_info, image_urls, created_at')
		.eq('is_active', true)
		.order('created_at', { ascending: false });

	if (error) {
		console.error('[marketplace/load] Failed to load products', error);
		return { products: [] };
	}

	return { products: products ?? [] };
}) satisfies PageServerLoad;
