import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	const { supabase } = locals;

	const [sourcesResult, runsResult, draftsResult] = await Promise.all([
		supabase
			.from('scraper_sources')
			.select('id, url, domain, title, is_active, scrape_count, last_searched_at, last_scraped_at, created_at')
			.order('created_at', { ascending: false }),

		supabase
			.from('scraper_runs')
			.select('id, run_type, status, sources_found, events_created, error_message, started_at, completed_at')
			.order('started_at', { ascending: false })
			.limit(20),

		supabase
			.from('tours')
			.select('id, title, description, start_date, locality, external_url, status, created_at')
			.eq('source', 'web')
			.in('status', ['draft'])
			.order('created_at', { ascending: false }),
	]);

	return {
		sources: sourcesResult.data ?? [],
		runs: runsResult.data ?? [],
		drafts: draftsResult.data ?? [],
	};
}) satisfies PageServerLoad;

export const actions = {
	toggleSource: async ({ request, locals: { supabase } }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		const is_active = fd.get('is_active') === 'true';

		const { error } = await supabase
			.from('scraper_sources')
			.update({ is_active: !is_active })
			.eq('id', id);

		if (error) return fail(500, { error: 'Kunne ikke opdatere kilden.' });
		return { success: true };
	},

	deleteSource: async ({ request, locals: { supabase } }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');

		const { error } = await supabase.from('scraper_sources').delete().eq('id', id);

		if (error) return fail(500, { error: 'Kunne ikke slette kilden.' });
		return { success: true };
	},

	publishDraft: async ({ request, locals: { supabase } }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');

		const { error } = await supabase
			.from('tours')
			.update({ status: 'published' })
			.eq('id', id)
			.eq('source', 'web');

		if (error) return fail(500, { error: 'Kunne ikke publicere tur.' });
		return { success: true };
	},

	deleteDraft: async ({ request, locals: { supabase } }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');

		const { error } = await supabase
			.from('tours')
			.delete()
			.eq('id', id)
			.eq('source', 'web')
			.eq('status', 'draft');

		if (error) return fail(500, { error: 'Kunne ikke slette kladde.' });
		return { success: true };
	},
} satisfies Actions;
