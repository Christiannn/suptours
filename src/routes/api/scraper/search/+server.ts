/**
 * POST /api/scraper/search
 *
 * Fase 1 – find danske SUP-event-websites og gem dem som kilder.
 * Kun admin.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchSUPEventSites } from '$lib/scraper/webSearch.server';
import { resolveAiScraperConfig } from '$lib/scraper/resolveAiScraperConfig.server';
import { requireScraperAdmin, assertAiKeyPresent } from '$lib/scraper/requireScraperAdmin.server';
import type { QueryStrategy } from '$lib/scraper/searchQueries';
import { toJson } from '$lib/scraper/jsonSafe';

type ScraperSearchRequestBody = {
	provider?: string;
	tier?: string;
	model?: string;
	modelId?: string;
	searchQueries?: string[];
	replaceQueries?: boolean;
	strategy?: string;
	domainPatterns?: string[];
	seedDomains?: string[];
	maxResults?: number;
	resultsPerQuery?: number;
	pages?: number;
	scoreThreshold?: number;
	maxPerDomain?: number;
	/** Kør `site:`-queries mod de kilder vi allerede har. */
	deepDiscovery?: boolean;
};

const STRATEGIES: QueryStrategy[] = ['curated', 'broad', 'exhaustive'];

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireScraperAdmin(locals);

	let body: ScraperSearchRequestBody | undefined;
	try {
		body = (await request.json()) as ScraperSearchRequestBody;
	} catch {
		body = undefined;
	}

	const aiConfig = resolveAiScraperConfig(body);
	assertAiKeyPresent(aiConfig);

	// Dybde-opdagelse: brug domæner vi allerede kender som udgangspunkt.
	let deepDiscoveryDomains: string[] = [];
	if (body?.deepDiscovery) {
		const { data } = await locals.supabase
			.from('scraper_sources')
			.select('domain')
			.eq('is_active', true)
			.limit(15);
		deepDiscoveryDomains = Array.from(new Set((data ?? []).map((r) => r.domain))).filter(Boolean);
	}

	const { data: run, error: runErr } = await locals.supabase
		.from('scraper_runs')
		.insert({ run_type: 'search', status: 'running' })
		.select('id')
		.single();

	if (runErr || !run) throw error(500, 'Kunne ikke oprette kørselslog');

	try {
		const strategy = STRATEGIES.includes(body?.strategy as QueryStrategy)
			? (body?.strategy as QueryStrategy)
			: 'broad';

		const { sources, stats } = await searchSUPEventSites(aiConfig, {
			searchQueries: body?.searchQueries,
			replaceQueries: body?.replaceQueries,
			strategy,
			domainPatterns: body?.domainPatterns,
			seedDomains: body?.seedDomains,
			maxResults: body?.maxResults,
			resultsPerQuery: body?.resultsPerQuery,
			pages: body?.pages,
			scoreThreshold: body?.scoreThreshold,
			maxPerDomain: body?.maxPerDomain,
			deepDiscoveryDomains
		});

		// Hvilke kilder kendte vi i forvejen? Bruges til at rapportere
		// nye vs. opdaterede, i stedet for bare "N fundet".
		const urls = sources.map((s) => s.url);
		const { data: known } = urls.length
			? await locals.supabase.from('scraper_sources').select('url').in('url', urls)
			: { data: [] as { url: string }[] };
		const knownUrls = new Set((known ?? []).map((r) => r.url));

		const now = new Date().toISOString();
		let created = 0;
		let updated = 0;

		for (const site of sources) {
			const isNew = !knownUrls.has(site.url);

			// Eksisterende kilder får kun opdateret timestamp og signaler —
			// `is_active` og `notes` er admins felter og røres ikke.
			const { error: upsertErr } = await locals.supabase.from('scraper_sources').upsert(
				{
					url: site.url,
					domain: site.domain,
					title: site.title,
					description: site.description,
					kind: site.kind,
					relevance_score: site.score,
					ai_confidence: site.confidence,
					found_via: site.foundVia,
					last_searched_at: now
				},
				{ onConflict: 'url' }
			);

			if (upsertErr) continue;
			if (isNew) created += 1;
			else updated += 1;
		}

		await locals.supabase
			.from('scraper_runs')
			.update({
				status: 'completed',
				sources_found: created + updated,
				queries_run: stats.queriesRun,
				raw_results: stats.rawResults,
				completed_at: now,
				error_message: stats.queryErrors.length ? stats.queryErrors.slice(0, 3).join('\n') : null,
				details: toJson({
					created,
					updated,
					afterDedupe: stats.afterDedupe,
					afterScoring: stats.afterScoring,
					afterAi: stats.afterAi,
					strategy,
					model: aiConfig.model
				})
			})
			.eq('id', run.id);

		return json({
			ok: true,
			sourcesFound: created + updated,
			created,
			updated,
			stats
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
