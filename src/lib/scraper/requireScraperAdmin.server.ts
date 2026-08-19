/**
 * requireScraperAdmin.server.ts
 *
 * Fælles adgangskontrol + nøgletjek for scraper-endpointsene.
 *
 * `hooks.server.ts` beskytter allerede `/admin`, men API-ruterne ligger
 * under `/api`, så hvert endpoint skal selv verificere admin. Det var
 * tidligere kopieret tre steder — her ét sted, så en fremtidig rute
 * ikke kan komme til at glemme det.
 */

import { error } from '@sveltejs/kit';
import type { User } from '@supabase/supabase-js';
import type { AiScraperConfig } from './aiScraperConfig';
import { getAnthropicApiKey, getGeminiApiKey } from '$lib/server/secrets';

export async function requireScraperAdmin(locals: App.Locals): Promise<{ user: User }> {
	const { user } = await locals.safeGetSession();
	if (!user) throw error(401, 'Unauthorized');

	const { data: profile } = await locals.supabase
		.from('profiles')
		.select('is_admin')
		.eq('id', user.id)
		.single();

	if (!profile?.is_admin) throw error(403, 'Forbidden');

	return { user };
}

/**
 * Fejl tidligt hvis den valgte udbyders nøgle mangler, i stedet for at
 * lade kørslen nå halvvejs og fejle midt i en batch.
 */
export function assertAiKeyPresent(config: AiScraperConfig): void {
	if (config.provider === 'gemini' && !getGeminiApiKey()) {
		throw error(400, 'GEMINI_API_KEY er ikke sat på serveren (.env — se local-dev.md)');
	}
	if (config.provider === 'claude' && !getAnthropicApiKey()) {
		throw error(400, 'ANTHROPIC_API_KEY er ikke sat på serveren');
	}
}
