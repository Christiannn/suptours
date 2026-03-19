/**
 * webSearch.server.ts
 *
 * Phase 1 – Base search.
 * Uses Brave Search API to find candidate URLs, then passes the results to
 * Claude which filters and returns only real SUP-event sites in Denmark.
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

/** Run all search queries and return deduplicated, Claude-filtered sources. */
export async function searchSUPEventSites(): Promise<DiscoveredSource[]> {
	const braveKey = process.env.BRAVE_SEARCH_API_KEY;
	if (!braveKey) throw new Error('BRAVE_SEARCH_API_KEY is not configured');

	const allRaw: RawResult[] = [];

	for (const query of SEARCH_QUERIES) {
		const hits = await braveSearch(query, braveKey);
		allRaw.push(...hits);
	}

	// Deduplicate raw results by URL before sending to Claude
	const unique = deduplicateRaw(allRaw);

	// Let Claude filter and normalise the results
	return await filterWithClaude(unique);
}

// ─── Brave Search ────────────────────────────────────────────────────────────

interface RawResult {
	url: string;
	title: string;
	description: string;
}

async function braveSearch(query: string, apiKey: string): Promise<RawResult[]> {
	const params = new URLSearchParams({
		q: query,
		count: '10',
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
		console.error(`Brave Search error ${res.status} for query: ${query}`);
		return [];
	}

	const data = (await res.json()) as { web?: { results?: RawResult[] } };
	return (data.web?.results ?? []).map((r) => ({
		url: r.url,
		title: r.title ?? '',
		description: r.description ?? '',
	}));
}

function deduplicateRaw(results: RawResult[]): RawResult[] {
	const seen = new Set<string>();
	return results.filter((r) => {
		if (seen.has(r.url)) return false;
		seen.add(r.url);
		return true;
	});
}

// ─── Claude filtering ────────────────────────────────────────────────────────

async function filterWithClaude(raw: RawResult[]): Promise<DiscoveredSource[]> {
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

	const response = await anthropic.messages.create({
		model: 'claude-sonnet-4-6',
		max_tokens: 2048,
		messages: [{ role: 'user', content: prompt }],
	});

	const text = response.content[0].type === 'text' ? response.content[0].text : '';

	try {
		const match = text.match(/\[[\s\S]*\]/);
		if (!match) return [];
		return JSON.parse(match[0]) as DiscoveredSource[];
	} catch {
		console.error('Failed to parse Claude response:', text);
		return [];
	}
}
