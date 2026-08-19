/**
 * webSearch.server.ts
 *
 * Fase 1 – opdagelse af danske SUP-arrangementer.
 *
 * Pipeline:
 *   1. Byg queries fra kataloget (`searchQueries.ts`) + admin-input.
 *   2. Kør dem mod Brave Search med paginering.
 *   3. Pre-score heuristisk (`relevance.ts`) — billigt frafiltrer støj.
 *   4. Dedupér på domæne, så én klub ikke fylder 6 pladser.
 *   5. Lad AI'en klassificere resten i små batches.
 *   6. Valgfrit: dybde-opdagelse med `site:`-queries på fundne domæner.
 *
 * Brave-kald køres med begrænset parallelitet og respekterer rate limits.
 */

import { getBraveSearchApiKey } from '$lib/server/secrets';
import type { AiScraperConfig } from './aiScraperConfig';
import { DEFAULT_AI_CONFIG } from './aiScraperConfig';
import { generateAiText } from './generateAiText.server';
import {
	buildSearchQueries,
	buildDeepDiscoveryQueries,
	DEFAULT_SEED_DOMAINS,
	type QueryStrategy
} from './searchQueries';
import {
	rankResults,
	dedupeByDomain,
	extractDomain,
	DEFAULT_SCORE_THRESHOLD,
	type ScoredResult
} from './relevance';

export interface DiscoveredSource {
	url: string;
	domain: string;
	title: string;
	description: string;
	/** Heuristisk score fra pre-filtret (0–100+). */
	score: number;
	/** AI'ens vurdering af hvor sandsynligt siden har events. */
	confidence: number;
	/** Hvilken slags side AI'en mener det er. */
	kind: SourceKind;
	/** Queryen der fandt kilden — nyttig til at forstå dækningen. */
	foundVia: string | null;
}

export type SourceKind = 'event_calendar' | 'club' | 'single_event' | 'operator' | 'other';

export interface SearchSUPEventSitesOptions {
	/** Ekstra queries fra admin — tilføjes forrest i kataloget. */
	searchQueries?: string[];
	/** Erstat kataloget helt med admins egne queries. */
	replaceQueries?: boolean;
	strategy?: QueryStrategy;
	domainPatterns?: string[];
	seedDomains?: string[];
	maxResults?: number;
	/** Resultater pr. query (Brave maks. 20 pr. kald). */
	resultsPerQuery?: number;
	/** Hent side 2+ fra Brave for de brede queries. */
	pages?: number;
	/** Kør `site:`-queries mod domæner vi allerede kender. */
	deepDiscoveryDomains?: string[];
	/** Heuristisk minimumsscore før AI'en spørges. */
	scoreThreshold?: number;
	/** Maks. antal kilder pr. domæne i resultatet. */
	maxPerDomain?: number;
}

export interface SearchOutcome {
	sources: DiscoveredSource[];
	stats: {
		queriesRun: number;
		rawResults: number;
		afterDedupe: number;
		afterScoring: number;
		afterAi: number;
		queryErrors: string[];
	};
}

const BRAVE_MAX_COUNT = 20;
/** Brave's gratis plan er 1 req/s — hold os under det. */
const BRAVE_DELAY_MS = 1100;
/** Hvor mange resultater AI'en klassificerer ad gangen. */
const AI_BATCH_SIZE = 20;

/**
 * Kør fase 1 og returnér kilder + statistik.
 */
export async function searchSUPEventSites(
	config: AiScraperConfig = DEFAULT_AI_CONFIG,
	options: SearchSUPEventSitesOptions = {}
): Promise<SearchOutcome> {
	const braveKey = getBraveSearchApiKey();
	if (!braveKey) {
		throw new Error('BRAVE_SEARCH_API_KEY is not configured (add to .env in project root)');
	}

	const adminQueries = (options.searchQueries ?? []).map((q) => q.trim()).filter(Boolean);
	const maxResults = clamp(options.maxResults ?? 50, 1, 300);
	const resultsPerQuery = clamp(options.resultsPerQuery ?? BRAVE_MAX_COUNT, 1, BRAVE_MAX_COUNT);
	const pages = clamp(options.pages ?? 1, 1, 5);
	const scoreThreshold = options.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD;

	const queries =
		options.replaceQueries && adminQueries.length
			? adminQueries
			: buildSearchQueries({
					strategy: options.strategy ?? 'broad',
					extraQueries: adminQueries,
					seedDomains: options.seedDomains ?? [...DEFAULT_SEED_DOMAINS]
				});

	// Dybde-opdagelse: find flere eventsider på domæner vi allerede kender.
	for (const domain of options.deepDiscoveryDomains ?? []) {
		queries.push(...buildDeepDiscoveryQueries(domain));
	}

	const queryErrors: string[] = [];
	const allRaw: TaggedResult[] = [];

	for (const query of queries) {
		for (let page = 0; page < pages; page++) {
			try {
				const hits = await braveWebSearch(query, braveKey, resultsPerQuery, page * resultsPerQuery);
				if (hits.length === 0) break; // Ingen flere sider for denne query.
				allRaw.push(...hits.map((h) => ({ ...h, foundVia: query })));
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				queryErrors.push(`${query}: ${message}`);
				// Rate limit rammer alle queries — stop hellere end at brænde kvote.
				if (/429|rate/i.test(message)) {
					return finish(allRaw, queryErrors, queries.length);
				}
				break;
			}
			await sleep(BRAVE_DELAY_MS);
		}
	}

	return finish(allRaw, queryErrors, queries.length);

	async function finish(
		raw: TaggedResult[],
		errors: string[],
		queriesRun: number
	): Promise<SearchOutcome> {
		const unique = deduplicateByUrl(raw).filter((r) =>
			matchesDomainPattern(r.url, options.domainPatterns ?? [])
		);

		const ranked = rankResults(unique, scoreThreshold);
		const perDomain = dedupeByDomain(ranked, clamp(options.maxPerDomain ?? 2, 1, 10));
		const limited = perDomain.slice(0, maxResults);

		const sources = await classifyWithAi(limited, config);

		return {
			sources,
			stats: {
				queriesRun,
				rawResults: raw.length,
				afterDedupe: unique.length,
				afterScoring: perDomain.length,
				afterAi: sources.length,
				queryErrors: errors
			}
		};
	}
}

// ─── Brave Search ─────────────────────────────────────────────────────────────

export interface BraveWebResult {
	url: string;
	title: string;
	description: string;
}

interface TaggedResult extends BraveWebResult {
	foundVia: string;
}

/**
 * Brave Web Search API. Bruges af scraperen og af admin-testendpointet.
 * `offset` er sidetal (Brave tæller i sider, ikke i resultater).
 */
export async function braveWebSearch(
	query: string,
	apiKey: string,
	count = 10,
	offset = 0
): Promise<BraveWebResult[]> {
	const params = new URLSearchParams({
		q: query,
		count: String(Math.min(count, BRAVE_MAX_COUNT)),
		country: 'DK',
		search_lang: 'da',
		// Slår Braves egen "spam/lav kvalitet"-filtrering til.
		safesearch: 'moderate'
	});
	if (offset > 0) params.set('offset', String(Math.min(Math.floor(offset / count), 9)));

	const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
		headers: {
			Accept: 'application/json',
			'Accept-Encoding': 'gzip',
			'X-Subscription-Token': apiKey
		},
		signal: AbortSignal.timeout(15_000)
	});

	if (!res.ok) {
		const errBody = await res.text().catch(() => '');
		throw new Error(`Brave Search HTTP ${res.status}: ${errBody.slice(0, 300)}`);
	}

	const data = (await res.json()) as { web?: { results?: BraveWebResult[] } };
	return (data.web?.results ?? []).map((r) => ({
		url: r.url,
		title: stripHtml(r.title ?? ''),
		description: stripHtml(r.description ?? '')
	}));
}

/** Brave markerer matchede ord med <strong> i snippets. */
function stripHtml(text: string): string {
	return text.replace(/<[^>]+>/g, '').trim();
}

function deduplicateByUrl(results: TaggedResult[]): TaggedResult[] {
	const seen = new Set<string>();
	return results.filter((r) => {
		const key = normalizeUrlKey(r.url);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** Ignorér fragment, trailing slash og tracking-parametre ved dedup. */
function normalizeUrlKey(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.hash = '';
		for (const key of [...parsed.searchParams.keys()]) {
			if (/^(utm_|fbclid|gclid|ref)/i.test(key)) parsed.searchParams.delete(key);
		}
		return parsed.toString().replace(/\/$/, '').toLowerCase();
	} catch {
		return url.toLowerCase();
	}
}

/** Wildcard-filter fra admin, fx `*.dk*`. Tom liste = ingen filtrering. */
function matchesDomainPattern(url: string, patterns: string[]): boolean {
	const cleaned = patterns.map((p) => p.trim().toLowerCase()).filter(Boolean);
	if (cleaned.length === 0) return true;

	let normalizedUrl = url.toLowerCase();
	let host = '';
	try {
		const parsed = new URL(url);
		normalizedUrl = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
		host = parsed.hostname.toLowerCase();
	} catch {
		/* behold rå streng */
	}

	return cleaned.some((pattern) => {
		const regex = new RegExp(`^${escapeRegex(pattern).replace(/\\\*/g, '.*')}$`);
		return regex.test(normalizedUrl) || (host !== '' && regex.test(host));
	});
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── AI-klassifikation ────────────────────────────────────────────────────────

/**
 * Klassificér i batches. Et fejlet batch koster kun sine egne
 * resultater — tidligere væltede ét ugyldigt AI-svar hele kørslen.
 */
async function classifyWithAi(
	scored: ScoredResult<TaggedResult>[],
	config: AiScraperConfig
): Promise<DiscoveredSource[]> {
	if (scored.length === 0) return [];

	const out: DiscoveredSource[] = [];

	for (let i = 0; i < scored.length; i += AI_BATCH_SIZE) {
		const batch = scored.slice(i, i + AI_BATCH_SIZE);
		try {
			out.push(...(await classifyBatch(batch, config)));
		} catch (e) {
			console.error('[webSearch] AI-klassifikation fejlede for batch', i, e);
			// Fald tilbage på heuristikken frem for at tabe kandidaterne.
			out.push(...batch.filter((s) => s.score >= 25).map(toFallbackSource));
		}
	}

	return out;
}

async function classifyBatch(
	batch: ScoredResult<TaggedResult>[],
	config: AiScraperConfig
): Promise<DiscoveredSource[]> {
	const candidates = batch.map((s, index) => ({
		id: index,
		url: s.result.url,
		title: s.result.title,
		description: s.result.description
	}));

	const prompt = `Du klassificerer websider for en dansk SUP-portal (Stand Up Paddleboard).

Kandidater:
${JSON.stringify(candidates, null, 1)}

For HVER kandidat: afgør om siden sandsynligvis indeholder KONKRETE SUP-arrangementer i Danmark
(ture, stævner, races, kurser, camps, fællesture, klubaktiviteter med datoer).

BEHOLD:
- Eventkalendere og aktivitetsoversigter
- Klub- og foreningssider med aktivitetsprogram
- Konkrete enkeltarrangementer
- Udbydere/skoler med datosatte hold og ture

AFVIS:
- Webshops og produktsider (boards, årer, våddragter)
- Test, anmeldelser og købsguides
- Nyhedsartikler uden kommende datoer
- Wikipedia, generelle sportsportaler, rejsebureauer
- Sider uden dansk tilknytning

Returner KUN et JSON-array. Udelad afviste kandidater helt:
[
  {
    "id": 0,
    "kind": "event_calendar" | "club" | "single_event" | "operator",
    "confidence": 0-100,
    "title": "Kort sigende titel (maks 80 tegn)",
    "description": "Hvad siden tilbyder (maks 150 tegn)"
  }
]

Er ingen kandidater relevante, returner [].`;

	const text = await generateAiText(prompt, config);
	const parsed = parseJsonArray(text);
	if (!parsed) return [];

	const out: DiscoveredSource[] = [];

	for (const item of parsed) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const id = Number(row.id);
		const source = batch[id];
		if (!source) continue;

		out.push({
			url: source.result.url,
			domain: extractDomain(source.result.url),
			title: asString(row.title) || source.result.title || source.result.url,
			description: asString(row.description) || source.result.description,
			score: source.score,
			confidence: clamp(Number(row.confidence) || 50, 0, 100),
			kind: asKind(row.kind),
			foundVia: source.result.foundVia
		});
	}

	return out;
}

/** Bruges når AI'en fejler — heuristikken alene er bedre end ingenting. */
function toFallbackSource(scored: ScoredResult<TaggedResult>): DiscoveredSource {
	return {
		url: scored.result.url,
		domain: extractDomain(scored.result.url),
		title: scored.result.title || scored.result.url,
		description: scored.result.description,
		score: scored.score,
		confidence: 40,
		kind: 'other',
		foundVia: scored.result.foundVia
	};
}

/**
 * Træk det første JSON-array ud af et modelsvar.
 * Modeller pakker ofte svaret i ```json-fences eller forklarende tekst.
 */
export function parseJsonArray(text: string): unknown[] | null {
	if (!text) return null;

	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const candidates = [fenced?.[1], text];

	for (const candidate of candidates) {
		if (!candidate) continue;
		const start = candidate.indexOf('[');
		const end = candidate.lastIndexOf(']');
		if (start === -1 || end <= start) continue;
		try {
			const parsed = JSON.parse(candidate.slice(start, end + 1));
			if (Array.isArray(parsed)) return parsed;
		} catch {
			/* prøv næste kandidat */
		}
	}

	return null;
}

function asString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function asKind(value: unknown): SourceKind {
	const allowed: SourceKind[] = ['event_calendar', 'club', 'single_event', 'operator', 'other'];
	return allowed.includes(value as SourceKind) ? (value as SourceKind) : 'other';
}

function clamp(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.max(min, Math.min(max, Math.floor(value)));
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
