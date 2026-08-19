/**
 * POST /api/scraper/extract
 *
 * Fase 2 for ÉN valgt kilde. Bruges fra admin-UI'et hvor man kan se
 * siden i preview og justere instruktionerne før udtrækning.
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scrapeEventsFromUrl } from '$lib/scraper/eventScraper.server';
import { resolveAiScraperConfig } from '$lib/scraper/resolveAiScraperConfig.server';
import { requireScraperAdmin, assertAiKeyPresent } from '$lib/scraper/requireScraperAdmin.server';
import { persistDrafts } from '$lib/scraper/persistDrafts.server';
import { toJson } from '$lib/scraper/jsonSafe';

type ExtractRequestBody = {
	url?: string;
	instructions?: string;
	provider?: string;
	tier?: string;
	model?: string;
	modelId?: string;
	followLinks?: boolean;
	maxLinkedPages?: number;
	includePast?: boolean;
	pruneStale?: boolean;
};

function normalizeUrl(raw: string): string {
	try {
		const url = new URL(raw);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			throw error(400, 'Kun http/https-URLs understøttes');
		}
		return url.toString();
	} catch {
		throw error(400, 'Ugyldig URL');
	}
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await requireScraperAdmin(locals);

	let body: ExtractRequestBody | undefined;
	try {
		body = (await request.json()) as ExtractRequestBody;
	} catch {
		body = undefined;
	}

	const sourceUrl = normalizeUrl(String(body?.url ?? ''));
	const aiConfig = resolveAiScraperConfig(body);
	assertAiKeyPresent(aiConfig);

	const { data: source } = await locals.supabase
		.from('scraper_sources')
		.select('id, consecutive_failures')
		.eq('url', sourceUrl)
		.maybeSingle();

	const { data: run, error: runErr } = await locals.supabase
		.from('scraper_runs')
		.insert({ run_type: 'scrape', status: 'running', target_url: sourceUrl })
		.select('id')
		.single();

	if (runErr || !run) throw error(500, 'Kunne ikke oprette kørselslog');

	try {
		const { events, rejected, diagnostics } = await scrapeEventsFromUrl(sourceUrl, aiConfig, {
			instructions: body?.instructions,
			followLinks: body?.followLinks ?? true,
			maxLinkedPages: body?.maxLinkedPages,
			includePast: body?.includePast
		});

		const persisted = await persistDrafts(events, {
			supabase: locals.supabase,
			creatorId: user.id,
			sourceUrl,
			sourceId: source?.id ?? null,
			// Standard: ryd kladder der ikke længere står på siden.
			pruneStale: body?.pruneStale ?? true
		});

		const failed = events.length === 0;
		await locals.supabase
			.from('scraper_sources')
			.update({
				last_scraped_at: new Date().toISOString(),
				last_event_count: events.length,
				consecutive_failures: failed ? (source?.consecutive_failures ?? 0) + 1 : 0,
				last_error: failed ? diagnostics.notes.join(' · ').slice(0, 500) || null : null
			})
			.eq('url', sourceUrl);

		await locals.supabase
			.from('scraper_runs')
			.update({
				status: 'completed',
				events_created: persisted.created + persisted.updated,
				events_rejected: rejected.length,
				completed_at: new Date().toISOString(),
				details: toJson({ ...persisted, diagnostics, rejected: rejected.slice(0, 20) })
			})
			.eq('id', run.id);

		return json({
			ok: true,
			draftsCreated: persisted.created,
			draftsUpdated: persisted.updated,
			skipped: persisted.skipped,
			extracted: events.length,
			rejected,
			diagnostics,
			errors: persisted.errors
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await locals.supabase
			.from('scraper_runs')
			.update({
				status: 'failed',
				error_message: message,
				completed_at: new Date().toISOString()
			})
			.eq('id', run.id);
		throw error(500, message);
	}
};
