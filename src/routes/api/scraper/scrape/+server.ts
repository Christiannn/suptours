/**
 * POST /api/scraper/scrape
 *
 * Fase 2 for ALLE aktive kilder — batch-kørslen.
 *
 * Kilder prioriteres efter hvornår de sidst blev skrabet, og kilder der
 * gentagne gange ikke har givet resultater springes over med jævne
 * mellemrum, så kvoten bruges på de kilder der faktisk leverer.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scrapeEventsFromUrl } from '$lib/scraper/eventScraper.server';
import { resolveAiScraperConfig } from '$lib/scraper/resolveAiScraperConfig.server';
import { requireScraperAdmin, assertAiKeyPresent } from '$lib/scraper/requireScraperAdmin.server';
import { persistDrafts } from '$lib/scraper/persistDrafts.server';
import { toJson } from '$lib/scraper/jsonSafe';

type ScrapeRequestBody = {
	provider?: string;
	tier?: string;
	model?: string;
	modelId?: string;
	instructions?: string;
	followLinks?: boolean;
	maxLinkedPages?: number;
	includePast?: boolean;
	/** Maks. antal kilder i denne kørsel. */
	maxSources?: number;
	/** Skrab også kilder der har fejlet gentagne gange. */
	includeFailing?: boolean;
};

/** Efter så mange tomme kørsler i træk nedprioriteres en kilde. */
const FAILURE_CUTOFF = 4;

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await requireScraperAdmin(locals);

	let body: ScrapeRequestBody | undefined;
	try {
		body = (await request.json()) as ScrapeRequestBody;
	} catch {
		body = undefined;
	}

	const aiConfig = resolveAiScraperConfig(body);
	assertAiKeyPresent(aiConfig);

	const maxSources = Math.max(1, Math.min(body?.maxSources ?? 25, 100));

	const { data: run, error: runErr } = await locals.supabase
		.from('scraper_runs')
		.insert({ run_type: 'scrape', status: 'running' })
		.select('id')
		.single();

	if (runErr || !run) throw error(500, 'Kunne ikke oprette kørselslog');

	// Ældste først, så alle kilder får tur over flere kørsler.
	let query = locals.supabase
		.from('scraper_sources')
		.select('id, url, scrape_count, consecutive_failures')
		.eq('is_active', true)
		.order('last_scraped_at', { ascending: true, nullsFirst: true })
		.limit(maxSources);

	if (!body?.includeFailing) {
		query = query.lt('consecutive_failures', FAILURE_CUTOFF);
	}

	const { data: sources } = await query;

	if (!sources || sources.length === 0) {
		await locals.supabase
			.from('scraper_runs')
			.update({ status: 'completed', completed_at: new Date().toISOString() })
			.eq('id', run.id);
		return json({ ok: true, eventsCreated: 0, sourcesProcessed: 0 });
	}

	let created = 0;
	let updated = 0;
	let rejectedTotal = 0;
	const errors: string[] = [];
	const perSource: Array<{ url: string; events: number; note: string | null }> = [];

	for (const source of sources) {
		try {
			const { events, rejected, diagnostics } = await scrapeEventsFromUrl(source.url, aiConfig, {
				instructions: body?.instructions,
				followLinks: body?.followLinks ?? false,
				maxLinkedPages: body?.maxLinkedPages ?? 3,
				includePast: body?.includePast
			});

			const persisted = await persistDrafts(events, {
				supabase: locals.supabase,
				creatorId: user.id,
				sourceUrl: source.url,
				sourceId: source.id,
				// Batch-kørslen rydder ikke op — et enkelt fejlet hent må
				// ikke slette kladder admin er ved at gennemgå.
				pruneStale: false
			});

			created += persisted.created;
			updated += persisted.updated;
			rejectedTotal += rejected.length;
			errors.push(...persisted.errors);

			const failed = events.length === 0;
			perSource.push({
				url: source.url,
				events: events.length,
				note: diagnostics.notes[0] ?? null
			});

			await locals.supabase
				.from('scraper_sources')
				.update({
					last_scraped_at: new Date().toISOString(),
					scrape_count: (source.scrape_count ?? 0) + 1,
					last_event_count: events.length,
					consecutive_failures: failed ? (source.consecutive_failures ?? 0) + 1 : 0,
					last_error: failed ? diagnostics.notes.join(' · ').slice(0, 500) || null : null
				})
				.eq('id', source.id);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			errors.push(`${source.url}: ${message}`);

			await locals.supabase
				.from('scraper_sources')
				.update({
					last_scraped_at: new Date().toISOString(),
					consecutive_failures: (source.consecutive_failures ?? 0) + 1,
					last_error: message.slice(0, 500)
				})
				.eq('id', source.id);
		}
	}

	// Kun en total fiasko markeres som failed — delvise fejl er normalt.
	const runStatus = errors.length >= sources.length ? 'failed' : 'completed';

	await locals.supabase
		.from('scraper_runs')
		.update({
			status: runStatus,
			events_created: created + updated,
			events_rejected: rejectedTotal,
			error_message: errors.length ? errors.slice(0, 5).join('\n') : null,
			completed_at: new Date().toISOString(),
			details: toJson({ created, updated, perSource, model: aiConfig.model })
		})
		.eq('id', run.id);

	return json({
		ok: true,
		sourcesProcessed: sources.length,
		eventsCreated: created,
		eventsUpdated: updated,
		eventsRejected: rejectedTotal,
		errors
	});
};
