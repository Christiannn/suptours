import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scrapeEventsFromUrl } from '$lib/scraper/eventScraper.server';
import { resolveAiScraperConfig } from '$lib/scraper/resolveAiScraperConfig.server';
import { getAnthropicApiKey, getGeminiApiKey } from '$lib/server/secrets';

type ExtractRequestBody = {
	url?: string;
	instructions?: string;
	provider?: string;
	tier?: string;
	modelId?: string;
};

function normalizeUrl(raw: string): string {
	try {
		return new URL(raw).toString();
	} catch {
		throw error(400, 'Ugyldig URL');
	}
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) throw error(401, 'Unauthorized');

	const { data: profile } = await locals.supabase
		.from('profiles')
		.select('is_admin')
		.eq('id', user.id)
		.single();
	if (!profile?.is_admin) throw error(403, 'Forbidden');

	let body: ExtractRequestBody | undefined;
	try {
		body = (await request.json()) as ExtractRequestBody;
	} catch {
		body = undefined;
	}

	const sourceUrl = normalizeUrl(String(body?.url ?? ''));
	const aiConfig = resolveAiScraperConfig(body);

	if (aiConfig.provider === 'gemini' && !getGeminiApiKey()) {
		throw error(400, 'GEMINI_API_KEY er ikke sat på serveren (.env — se local-dev.md)');
	}
	if (aiConfig.provider === 'claude' && !getAnthropicApiKey()) {
		throw error(400, 'ANTHROPIC_API_KEY er ikke sat på serveren');
	}

	const { data: run, error: runErr } = await locals.supabase
		.from('scraper_runs')
		.insert({ run_type: 'scrape', status: 'running' })
		.select('id')
		.single();
	if (runErr || !run) {
		throw error(500, 'Failed to create scraper run record');
	}

	try {
		const events = await scrapeEventsFromUrl(sourceUrl, aiConfig, {
			instructions: body?.instructions,
		});

		// URL is the key: replace previous web drafts from this exact source URL.
		await locals.supabase
			.from('tours')
			.delete()
			.eq('source', 'web')
			.eq('status', 'draft')
			.eq('external_url', sourceUrl);

		const today = new Date().toISOString().slice(0, 10);
		let draftsCreated = 0;
		for (const ev of events) {
			const { error: insertErr } = await locals.supabase.from('tours').insert({
				creator_id: user.id,
				title: ev.title?.trim() || 'SUP tur (udtrukket)',
				description: ev.description,
				start_date: ev.start_date ?? today,
				end_date: ev.end_date,
				start_time: ev.start_time,
				locality: ev.locality,
				external_url: sourceUrl,
				tags: ev.tags,
				contact_info: ev.contact_info,
				max_participants: ev.max_participants,
				responsible_person: ev.responsible_person,
				source: 'web',
				status: 'draft',
			});
			if (!insertErr) draftsCreated += 1;
		}

		await locals.supabase
			.from('scraper_sources')
			.update({
				last_scraped_at: new Date().toISOString(),
			})
			.eq('url', sourceUrl);

		await locals.supabase
			.from('scraper_runs')
			.update({
				status: 'completed',
				events_created: draftsCreated,
				completed_at: new Date().toISOString(),
			})
			.eq('id', run.id);

		return json({ ok: true, draftsCreated, extracted: events.length });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await locals.supabase
			.from('scraper_runs')
			.update({
				status: 'failed',
				error_message: message,
				completed_at: new Date().toISOString(),
			})
			.eq('id', run.id);
		throw error(500, message);
	}
};
