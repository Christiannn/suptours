/**
 * webSearch.server.ts
 *
 * Phase 1 – Base search.
 * Uses Brave Search API to find candidate URLs, then passes the results to
 * Claude or Gemini to filter and return only real SUP-event sites in Denmark.
 */

import { getBraveSearchApiKey } from '$lib/server/secrets';
import type { AiScraperConfig } from './aiScraperConfig';
import { DEFAULT_AI_CONFIG } from './aiScraperConfig';
import { generateAiText } from './generateAiText.server';

export interface DiscoveredSource {
	url: string;
	domain: string;
	title: string;
	description: string;
}

const SEARCH_QUERIES = [
	'SUP arrangementer Danmark 2025 2026',
	'stand up paddleboard events Danmark race',
	'SUP tour race DK kalender',
	'paddle board stævne Danmark',
	'SUP klub events Danmark',
];

export async function searchSUPEventSites(
	config: AiScraperConfig = DEFAULT_AI_CONFIG,
): Promise<DiscoveredSource[]> {
	const braveKey = getBraveSearchApiKey();
	if (!braveKey) throw new Error('BRAVE_SEARCH_API_KEY is not configured (add to .env in project root)');

	const allRaw: BraveWebResult[] = [];

	for (const query of SEARCH_QUERIES) {
		try {
			const hits = await braveWebSearch(query, braveKey, 10);
			allRaw.push(...hits);
		} catch (e) {
			console.error('[webSearch] Brave fejl for query:', query, e);
		}
	}

	const unique = deduplicateRaw(allRaw);

	return await filterWithAi(unique, config);
}

export interface BraveWebResult {
	url: string;
	title: string;
	description: string;
}

/** Brave Web Search API — bruges af scraper og admin-test. */
export async function braveWebSearch(
	query: string,
	apiKey: string,
	count = 10,
): Promise<BraveWebResult[]> {
	const params = new URLSearchParams({
		q: query,
		count: String(count),
		country: 'DK',
		search_lang: 'da',
	});

	const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
		headers: {
			Accept: 'application/json',
			'Accept-Encoding': 'gzip',
			'X-Subscription-Token': apiKey,
		},
		signal: AbortSignal.timeout(15_000),
	});

	if (!res.ok) {
		const errBody = await res.text().catch(() => '');
		throw new Error(`Brave Search HTTP ${res.status}: ${errBody.slice(0, 500)}`);
	}

	const data = (await res.json()) as { web?: { results?: BraveWebResult[] } };
	return (data.web?.results ?? []).map((r) => ({
		url: r.url,
		title: r.title ?? '',
		description: r.description ?? '',
	}));
}

function deduplicateRaw(results: BraveWebResult[]): BraveWebResult[] {
	const seen = new Set<string>();
	return results.filter((r) => {
		if (seen.has(r.url)) return false;
		seen.add(r.url);
		return true;
	});
}

async function filterWithAi(raw: BraveWebResult[], config: AiScraperConfig): Promise<DiscoveredSource[]> {
	if (raw.length === 0) return [];

	const prompt = `
Du er en assistent der identificerer websites med SUP (Stand Up Paddleboard) arrangementer i Danmark.

Her er en liste af søgeresultater:
${JSON.stringify(raw, null, 2)}

Opgave:
1. Behold KUN URLs der er dedikerede SUP-event websites, SUP-klubsider, eller event-kalendere for Danmark.
2. Udelad: søgemaskiner, sociale medier (facebook.com, instagram.com osv.), Wikipedia, generelle sportsportaler og ikke-relevante sider.
3. For hver bevaret URL: udtræk det primære domæne (fx "supklubben.dk"), en kort titel og beskrivelse.

Returner et JSON-array med dette format – intet andet:
[
  {
    "url": "https://example.dk/sup-events",
    "domain": "example.dk",
    "title": "Kort sidetitel",
    "description": "Hvad siden handler om (maks 150 tegn)"
  }
]

Hvis ingen resultater er relevante, returner [].
`;

	const text = await generateAiText(prompt, config);

	try {
		const match = text.match(/\[[\s\S]*\]/);
		if (!match) return [];
		return JSON.parse(match[0]) as DiscoveredSource[];
	} catch {
		console.error('Failed to parse AI filter response:', text);
		return [];
	}
}
