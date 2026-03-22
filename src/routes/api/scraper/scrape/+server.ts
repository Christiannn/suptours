/**
 * POST /api/scraper/scrape
 *
 * Triggers the event-extraction phase.
 * Iterates all active scraper_sources, fetches each URL, extracts events via
 * Gemini, and inserts them as draft tours (source='web', status='draft').
 * Only callable by admin users.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scrapeEventsFromUrl } from '$lib/scraper/eventScraper.server';
import { resolveAiScraperConfig } from '$lib/scraper/resolveAiScraperConfig.server';
import { getAnthropicApiKey, getGeminiApiKey } from '$lib/server/secrets';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) throw error(401, 'Unauthorized');

	const { data: profile } = await locals.supabase
		.from('profiles')
		.select('is_admin')
		.eq('id', user.id)
		.single();

	if (!profile?.is_admin) throw error(403, 'Forbidden');

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		body = undefined;
	}
	const aiConfig = resolveAiScraperConfig(body);

	if (aiConfig.provider === 'gemini' && !getGeminiApiKey()) {
		throw error(400, 'GEMINI_API_KEY er ikke sat på serveren (.env — se local-dev.md)');
	}
	if (aiConfig.provider === 'claude' && !getAnthropicApiKey()) {
		throw error(400, 'ANTHROPIC_API_KEY er ikke sat på serveren');
	}

	// Create a run record
	const { data: run, error: runErr } = await locals.supabase
		.from('scraper_runs')
		.insert({ run_type: 'scrape', status: 'running' })
		.select('id')
		.single();

	if (runErr || !run) {
		throw error(500, 'Failed to create scraper run record');
	}

	// Fetch all active sources (include scrape_count so we can increment it)
	const { data: sources } = await locals.supabase
		.from('scraper_sources')
		.select('id, url, scrape_count')
		.eq('is_active', true)
		.order('last_scraped_at', { ascending: true, nullsFirst: true });

	if (!sources || sources.length === 0) {
		await locals.supabase
			.from('scraper_runs')
			.update({ status: 'completed', completed_at: new Date().toISOString() })
			.eq('id', run.id);
		return json({ ok: true, eventsCreated: 0 });
	}

	let eventsCreated = 0;
	const errors: string[] = [];

	for (const source of sources) {
		try {
			const events = await scrapeEventsFromUrl(source.url, aiConfig);

			for (const ev of events) {
				// start_date is required by the schema – skip events with unknown date
				if (!ev.start_date) continue;

				const { error: insertErr } = await locals.supabase.from('tours').insert({
					creator_id: user.id,
					title: ev.title,
					description: ev.description,
					start_date: ev.start_date,
					end_date: ev.end_date,
					start_time: ev.start_time,
					locality: ev.locality,
					external_url: ev.external_url,
					tags: ev.tags,
					contact_info: ev.contact_info,
					max_participants: ev.max_participants,
					responsible_person: ev.responsible_person,
					source: 'web',
					status: 'draft',
				});

				if (!insertErr) eventsCreated++;
			}

			// Update last_scraped_at and increment scrape_count
			await locals.supabase
				.from('scraper_sources')
				.update({
					last_scraped_at: new Date().toISOString(),
					scrape_count: (source.scrape_count ?? 0) + 1,
				})
				.eq('id', source.id);
		} catch (err) {
			errors.push(`${source.url}: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	const runStatus = errors.length === sources.length ? 'failed' : 'completed';
	const errorMsg = errors.length ? errors.slice(0, 5).join('\n') : null;

	await locals.supabase
		.from('scraper_runs')
		.update({
			status: runStatus,
			events_created: eventsCreated,
			error_message: errorMsg,
			completed_at: new Date().toISOString(),
		})
		.eq('id', run.id);

	return json({ ok: true, eventsCreated, errors });
};
