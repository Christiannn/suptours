import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	const { supabase } = locals;

	const [sourcesResult, runsResult, draftsResult] = await Promise.all([
		supabase
			.from('scraper_sources')
			.select(
				'id, url, domain, title, description, kind, is_active, scrape_count, relevance_score, ai_confidence, found_via, last_error, consecutive_failures, last_event_count, last_searched_at, last_scraped_at, created_at'
			)
			.order('is_active', { ascending: false })
			.order('last_event_count', { ascending: false })
			.order('created_at', { ascending: false }),

		supabase
			.from('scraper_runs')
			.select(
				'id, run_type, status, sources_found, events_created, events_rejected, queries_run, raw_results, target_url, error_message, started_at, completed_at'
			)
			.order('started_at', { ascending: false })
			.limit(25),

		// Kladder + provenance, så admin kan bedømme uden at åbne kilden.
		supabase
			.from('tours')
			.select(
				'id, title, description, start_date, end_date, start_time, locality, image_url, external_url, tags, contact_info, responsible_person, max_participants, status, created_at, scraper_draft_meta(confidence, evidence, price, distance_km, difficulty, organizer, source_url)'
			)
			.eq('source', 'web')
			.eq('status', 'draft')
			.order('start_date', { ascending: true })
	]);

	return {
		sources: sourcesResult.data ?? [],
		runs: runsResult.data ?? [],
		drafts: draftsResult.data ?? []
	};
}) satisfies PageServerLoad;

/** Læs et id-felt fra formdata og fejl pænt hvis det mangler. */
async function readId(request: Request, field = 'id'): Promise<string | null> {
	const fd = await request.formData();
	const value = String(fd.get(field) ?? '').trim();
	return value || null;
}

export const actions = {
	toggleSource: async ({ request, locals: { supabase } }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		const isActive = fd.get('is_active') === 'true';
		if (!id) return fail(400, { error: 'Manglende id.' });

		const { error } = await supabase
			.from('scraper_sources')
			.update({ is_active: !isActive })
			.eq('id', id);

		if (error) return fail(500, { error: 'Kunne ikke opdatere kilden.' });
		return { success: true };
	},

	/** Nulstil fejltælleren, så en kilde kommer med i batch-kørslen igen. */
	resetFailures: async ({ request, locals: { supabase } }) => {
		const id = await readId(request);
		if (!id) return fail(400, { error: 'Manglende id.' });

		const { error } = await supabase
			.from('scraper_sources')
			.update({ consecutive_failures: 0, last_error: null })
			.eq('id', id);

		if (error) return fail(500, { error: 'Kunne ikke nulstille kilden.' });
		return { success: true };
	},

	deleteSource: async ({ request, locals: { supabase } }) => {
		const id = await readId(request);
		if (!id) return fail(400, { error: 'Manglende id.' });

		const { error } = await supabase.from('scraper_sources').delete().eq('id', id);
		if (error) return fail(500, { error: 'Kunne ikke slette kilden.' });
		return { success: true };
	},

	publishDraft: async ({ request, locals: { supabase } }) => {
		const id = await readId(request);
		if (!id) return fail(400, { error: 'Manglende id.' });

		const { error } = await supabase
			.from('tours')
			.update({ status: 'published' })
			.eq('id', id)
			.eq('source', 'web')
			.eq('status', 'draft');

		if (error) return fail(500, { error: 'Kunne ikke publicere tur.' });
		return { success: true };
	},

	/** Publicér alt der ligger over en konfidensgrænse på én gang. */
	publishHighConfidence: async ({ request, locals: { supabase } }) => {
		const fd = await request.formData();
		const threshold = Number(fd.get('threshold') ?? 80);

		const { data: meta } = await supabase
			.from('scraper_draft_meta')
			.select('tour_id')
			.gte('confidence', Number.isFinite(threshold) ? threshold : 80);

		const ids = (meta ?? []).map((m) => m.tour_id);
		if (ids.length === 0) return { success: true, published: 0 };

		const { error, count } = await supabase
			.from('tours')
			.update({ status: 'published' }, { count: 'exact' })
			.in('id', ids)
			.eq('source', 'web')
			.eq('status', 'draft');

		if (error) return fail(500, { error: 'Kunne ikke publicere kladder.' });
		return { success: true, published: count ?? 0 };
	},

	deleteDraft: async ({ request, locals: { supabase } }) => {
		const id = await readId(request);
		if (!id) return fail(400, { error: 'Manglende id.' });

		const { error } = await supabase
			.from('tours')
			.delete()
			.eq('id', id)
			.eq('source', 'web')
			.eq('status', 'draft');

		if (error) return fail(500, { error: 'Kunne ikke slette kladde.' });
		return { success: true };
	},

	/** Ryd alle kladder — nyttigt efter en kørsel med dårlige instruktioner. */
	deleteAllDrafts: async ({ locals: { supabase } }) => {
		const { error } = await supabase
			.from('tours')
			.delete()
			.eq('source', 'web')
			.eq('status', 'draft');

		if (error) return fail(500, { error: 'Kunne ikke rydde kladder.' });
		return { success: true };
	}
} satisfies Actions;
