/**
 * POST /api/scraper/search
 *
 * Triggers the base web-search phase.
 * Finds SUP-event websites in Denmark and upserts them into scraper_sources.
 * Only callable by admin users.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchSUPEventSites } from '$lib/scraper/webSearch.server';

export const POST: RequestHandler = async ({ locals }) => {
	// Admin protection is enforced by hooks.server.ts for /api/scraper/*
	// but we add an explicit guard here as well.
	const { user } = await locals.safeGetSession();
	if (!user) throw error(401, 'Unauthorized');

	const { data: profile } = await locals.supabase
		.from('profiles')
		.select('is_admin')
		.eq('id', user.id)
		.single();

	if (!profile?.is_admin) throw error(403, 'Forbidden');

	// Create a run record
	const { data: run, error: runErr } = await locals.supabase
		.from('scraper_runs')
		.insert({ run_type: 'search', status: 'running' })
		.select('id')
		.single();

	if (runErr || !run) {
		throw error(500, 'Failed to create scraper run record');
	}

	let sourcesFound = 0;

	try {
		const sites = await searchSUPEventSites();
		sourcesFound = sites.length;

		for (const site of sites) {
			await locals.supabase.from('scraper_sources').upsert(
				{
					url: site.url,
					domain: site.domain,
					title: site.title,
					description: site.description,
					last_searched_at: new Date().toISOString(),
				},
				{
					onConflict: 'url',
					// Only update the timestamp and metadata, preserve is_active / notes
					ignoreDuplicates: false,
				}
			);
		}

		// Mark run as completed
		await locals.supabase
			.from('scraper_runs')
			.update({ status: 'completed', sources_found: sourcesFound, completed_at: new Date().toISOString() })
			.eq('id', run.id);

		return json({ ok: true, sourcesFound });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);

		await locals.supabase
			.from('scraper_runs')
			.update({ status: 'failed', error_message: msg, completed_at: new Date().toISOString() })
			.eq('id', run.id);

		throw error(500, msg);
	}
};
