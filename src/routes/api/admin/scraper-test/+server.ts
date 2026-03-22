/**
 * POST /api/admin/scraper-test
 * Admin-only integration test: Brave top-1 for "SUPTOUR" + AI beskrivelse.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { braveWebSearch } from '$lib/scraper/webSearch.server';
import { generateAiText } from '$lib/scraper/generateAiText.server';
import { resolveAiScraperConfig } from '$lib/scraper/resolveAiScraperConfig.server';
import {
	getAnthropicApiKey,
	getBraveSearchApiKey,
	getGeminiApiKey,
} from '$lib/server/secrets';

export type ScraperTestStep = {
	step: number;
	title: string;
	ok: boolean;
	detail?: string;
	error?: string;
	payload?: unknown;
};

function slog(msg: string, extra?: unknown) {
	console.log(`[scraper-test] ${msg}`, extra !== undefined ? extra : '');
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

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		body = undefined;
	}

	const steps: ScraperTestStep[] = [];
	const aiConfig = resolveAiScraperConfig(body);

	// Step 1 — valgt AI (fra body = samme som Agenter localStorage)
	try {
		slog('Step 1: AI-konfiguration (provider/model fra request — nøgler vises aldrig)', {
			provider: aiConfig.provider,
			model: aiConfig.model,
		});
		steps.push({
			step: 1,
			title: 'AI-konfiguration (valgt model)',
			ok: true,
			detail: `provider=${aiConfig.provider}, model=${aiConfig.model}`,
			payload: { provider: aiConfig.provider, model: aiConfig.model },
		});
	} catch (e) {
		const err = e instanceof Error ? e.message : String(e);
		slog('Step 1 FEJL', err);
		steps.push({ step: 1, title: 'AI-konfiguration', ok: false, error: err });
		return json({ ok: false, steps, finalMessage: null });
	}

	// Step 2 — nøgler på serveren (kun status)
	try {
		const brave = !!getBraveSearchApiKey();
		const gemini = !!getGeminiApiKey();
		const anthropic = !!getAnthropicApiKey();
		const needGemini = aiConfig.provider === 'gemini';
		const needAnthropic = aiConfig.provider === 'claude';

		slog('Step 2: Nøgle-status (loaded=true)', {
			BRAVE_SEARCH_API_KEY: brave,
			GEMINI_API_KEY: gemini,
			ANTHROPIC_API_KEY: anthropic,
			needsForProvider: needGemini ? 'gemini' : 'anthropic',
		});

		const aiOk = needGemini ? gemini : anthropic;
		const ok = brave && aiOk;
		steps.push({
			step: 2,
			title: 'API-nøgler (server .env)',
			ok,
			detail: `Brave: ${brave ? 'indlæst' : 'MANGLER'} · ${
				needGemini ? `Gemini: ${gemini ? 'indlæst' : 'MANGLER'}` : `Anthropic: ${anthropic ? 'indlæst' : 'MANGLER'}`
			}`,
			payload: { brave, gemini, anthropic },
		});

		if (!brave) {
			throw new Error('BRAVE_SEARCH_API_KEY mangler i .env');
		}
		if (!aiOk) {
			throw new Error(
				needGemini ? 'GEMINI_API_KEY mangler i .env' : 'ANTHROPIC_API_KEY mangler i .env',
			);
		}
	} catch (e) {
		const err = e instanceof Error ? e.message : String(e);
		slog('Step 2 FEJL', err);
		steps.push({
			step: 2,
			title: 'API-nøgler',
			ok: false,
			error: err,
		});
		return json({ ok: false, steps, finalMessage: null });
	}

	const braveKey = getBraveSearchApiKey()!;

	// Step 3 — Brave API-kald
	let top: { url: string; title: string; description: string } | null = null;
	try {
		slog('Step 3: Brave søgning q="SUPTOUR" count=1');
		const results = await braveWebSearch('SUPTOUR', braveKey, 1);
		top = results[0] ?? null;
		slog('Step 3: rækker returneret', { count: results.length, top });
		steps.push({
			step: 3,
			title: 'Brave API: søg "SUPTOUR" (top 1)',
			ok: true,
			detail: top
				? `Fundet: ${top.title}`
				: 'Ingen web-resultater (tom liste)',
			payload: { resultCount: results.length, top },
		});
		if (!top) {
			throw new Error('Brave returnerede 0 resultater for "SUPTOUR"');
		}
	} catch (e) {
		const err = e instanceof Error ? e.message : String(e);
		slog('Step 3 FEJL', err);
		steps.push({ step: 3, title: 'Brave API', ok: false, error: err });
		return json({ ok: false, steps, finalMessage: null });
	}

	// Step 4 — vis resultat (allerede i step 3 payload)
	try {
		slog('Step 4: Søgeresultat (top 1)', top);
		steps.push({
			step: 4,
			title: 'Søgeresultat (top 1)',
			ok: true,
			detail: JSON.stringify(top, null, 2),
			payload: top,
		});
	} catch (e) {
		const err = e instanceof Error ? e.message : String(e);
		slog('Step 4 FEJL', err);
		steps.push({ step: 4, title: 'Søgeresultat', ok: false, error: err });
		return json({ ok: false, steps, finalMessage: null });
	}

	// Step 5 — AI prompt
	let aiRaw = '';
	try {
		const prompt = `beskriv følgende søgeresultat fra Brave Search (hvad handler siden om, kort på dansk):\n${JSON.stringify(top, null, 2)}`;
		slog('Step 5: AI prompt sendes (længde tegn)', prompt.length);
		aiRaw = await generateAiText(prompt, aiConfig);
		slog('Step 5: AI svar modtaget (længde tegn)', aiRaw.length);
		steps.push({
			step: 5,
			title: 'AI: beskriv resultatet',
			ok: true,
			detail: aiRaw.slice(0, 2000) + (aiRaw.length > 2000 ? '…' : ''),
			payload: { text: aiRaw },
		});
	} catch (e) {
		const err = e instanceof Error ? e.message : String(e);
		slog('Step 5 FEJL', err);
		steps.push({ step: 5, title: 'AI-kald', ok: false, error: err });
		return json({ ok: false, steps, finalMessage: null });
	}

	// Step 6 — slutbesked
	const finalMessage =
		`**Hvad siden indeholder (ifølge AI)**\n\n${aiRaw.trim()}\n\n---\n**Kilde (top 1):** ${top.url}`;
	try {
		slog('Step 6: Slutbesked klar');
		steps.push({
			step: 6,
			title: 'Slutbesked',
			ok: true,
			detail: finalMessage,
			payload: { summary: aiRaw.trim(), url: top.url },
		});
	} catch (e) {
		const err = e instanceof Error ? e.message : String(e);
		slog('Step 6 FEJL', err);
		steps.push({ step: 6, title: 'Slutbesked', ok: false, error: err });
		return json({ ok: false, steps, finalMessage: null });
	}

	slog('Test færdig OK');
	return json({ ok: true, steps, finalMessage });
};
