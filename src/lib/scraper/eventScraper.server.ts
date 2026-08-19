/**
 * eventScraper.server.ts
 *
 * Fase 2 – udtrækning af konkrete arrangementer fra en kilde-URL.
 *
 * Pipeline:
 *   1. Hent siden (med redirect-håndtering og størrelsesloft).
 *   2. Parse struktur: JSON-LD schema.org/Event, OpenGraph, links, datoer.
 *   3. Er der brugbar JSON-LD, bruges den som grundsandhed — den er
 *      præcis og gratis, hvor AI-gætteri er hverken.
 *   4. AI'en kaldes på den link- og dato-bevarende brødtekst, og får
 *      JSON-LD med som kontekst den skal supplere, ikke modsige.
 *   5. Valgfrit dybde-1 crawl: en kalenderside linker til enkelte
 *      events, hvor de rigtige detaljer står.
 *   6. Alt normaliseres og valideres (`normalizeEvent.ts`).
 */

import type { AiScraperConfig } from './aiScraperConfig';
import { DEFAULT_AI_CONFIG } from './aiScraperConfig';
import { generateAiText } from './generateAiText.server';
import { extractPage, type PageExtract, type StructuredEvent } from './htmlExtract.server';
import {
	normalizeEvents,
	type NormalizedEvent,
	type RawExtractedEvent,
	type RejectedEvent
} from './normalizeEvent';
import { parseJsonArray } from './webSearch.server';

export interface ScrapeEventOptions {
	/** Ekstra instruktioner fra admin, indsættes i prompten. */
	instructions?: string;
	/** Følg links til enkelt-events fra en kalenderside. */
	followLinks?: boolean;
	/** Maks. antal underliggende sider der hentes. */
	maxLinkedPages?: number;
	/** Medtag events uden dato i fremtiden (til historik-import). */
	includePast?: boolean;
}

export interface ScrapeResult {
	events: NormalizedEvent[];
	rejected: RejectedEvent[];
	diagnostics: {
		fetched: boolean;
		httpStatus: number | null;
		textLength: number;
		jsonLdEvents: number;
		linkedPagesFetched: number;
		aiCalls: number;
		notes: string[];
	};
}

const MAX_BYTES = 3_000_000;
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Hent én URL og returnér validerede arrangementer.
 */
export async function scrapeEventsFromUrl(
	url: string,
	config: AiScraperConfig = DEFAULT_AI_CONFIG,
	options: ScrapeEventOptions = {}
): Promise<ScrapeResult> {
	const notes: string[] = [];
	const diagnostics: ScrapeResult['diagnostics'] = {
		fetched: false,
		httpStatus: null,
		textLength: 0,
		jsonLdEvents: 0,
		linkedPagesFetched: 0,
		aiCalls: 0,
		notes
	};

	const fetched = await fetchPage(url);
	diagnostics.httpStatus = fetched.status;

	if (!fetched.html) {
		notes.push(fetched.error ?? `Kunne ikke hente siden (HTTP ${fetched.status ?? '?'})`);
		return { events: [], rejected: [], diagnostics };
	}

	diagnostics.fetched = true;

	const page = extractPage(fetched.html, fetched.finalUrl);
	diagnostics.textLength = page.text.length;
	diagnostics.jsonLdEvents = page.structuredEvents.length;

	if (page.structuredEvents.length > 0) {
		notes.push(`${page.structuredEvents.length} event(s) fundet i JSON-LD (schema.org)`);
	}
	if (page.lang && !page.lang.startsWith('da')) {
		notes.push(`Siden erklærer sprog "${page.lang}" — kontrollér dansk relevans`);
	}

	const raw: RawExtractedEvent[] = [];

	// 1) Struktureret data først — det er den mest pålidelige kilde.
	raw.push(...page.structuredEvents.map(fromStructuredEvent));

	// 2) AI på brødteksten. Kører også når JSON-LD fandtes, fordi mange
	//    sider kun markerer ét af flere events op.
	if (page.text.length >= 120) {
		const aiEvents = await extractWithAi(page, fetched.finalUrl, config, options, notes);
		diagnostics.aiCalls += 1;
		raw.push(...aiEvents);
	} else {
		notes.push('For lidt brødtekst til AI-udtrækning');
	}

	// 3) Dybde-1: hent de enkelte eventsider en kalender linker til.
	if (options.followLinks && page.candidateLinks.length > 0) {
		const limit = Math.max(0, Math.min(options.maxLinkedPages ?? 5, 10));
		const linked = page.candidateLinks.filter((l) => l.url !== fetched.finalUrl).slice(0, limit);

		for (const link of linked) {
			const sub = await fetchPage(link.url);
			if (!sub.html) continue;
			diagnostics.linkedPagesFetched += 1;

			const subPage = extractPage(sub.html, sub.finalUrl);
			raw.push(...subPage.structuredEvents.map(fromStructuredEvent));

			if (subPage.structuredEvents.length === 0 && subPage.text.length >= 120) {
				const subEvents = await extractWithAi(subPage, sub.finalUrl, config, options, notes);
				diagnostics.aiCalls += 1;
				raw.push(...subEvents);
			}
		}

		if (diagnostics.linkedPagesFetched > 0) {
			notes.push(`${diagnostics.linkedPagesFetched} underside(r) gennemgået`);
		}
	}

	const { events, rejected } = normalizeEvents(raw, {
		sourceUrl: fetched.finalUrl,
		fallbackImage: page.pageImage,
		requireUpcoming: !options.includePast
	});

	if (raw.length > 0 && events.length === 0) {
		notes.push(`Alle ${raw.length} kandidat(er) blev filtreret fra — se afviste`);
	}

	return { events, rejected, diagnostics };
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

interface FetchResult {
	html: string | null;
	status: number | null;
	finalUrl: string;
	error?: string;
}

async function fetchPage(url: string): Promise<FetchResult> {
	try {
		const res = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; SUPToursBot/1.0; +https://suptours.dk)',
				Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
				'Accept-Language': 'da-DK,da;q=0.9,en;q=0.6'
			},
			redirect: 'follow',
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
		});

		// `res.url` er efter redirects — vigtigt for at gøre links absolutte.
		const finalUrl = res.url || url;

		if (!res.ok) {
			return { html: null, status: res.status, finalUrl, error: `HTTP ${res.status}` };
		}

		const contentType = res.headers.get('content-type') ?? '';
		if (contentType && !/text\/html|application\/xhtml|text\/plain/i.test(contentType)) {
			return {
				html: null,
				status: res.status,
				finalUrl,
				error: `Uventet content-type: ${contentType}`
			};
		}

		const text = await res.text();
		if (text.length > MAX_BYTES) {
			return { html: text.slice(0, MAX_BYTES), status: res.status, finalUrl };
		}
		return { html: text, status: res.status, finalUrl };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return {
			html: null,
			status: null,
			finalUrl: url,
			error: /timeout|abort/i.test(message) ? 'Timeout ved hentning' : message
		};
	}
}

// ─── JSON-LD → rå event ───────────────────────────────────────────────────────

function fromStructuredEvent(event: StructuredEvent): RawExtractedEvent {
	const locality = event.locationName ?? event.locationAddress ?? null;
	const price =
		event.price != null ? `${event.price}${event.currency ? ` ${event.currency}` : ''}` : null;

	return {
		title: event.name ?? null,
		description: event.description ?? null,
		// schema.org bruger ISO 8601 — dato og evt. klokkeslæt i ét felt.
		start_date: event.startDate?.slice(0, 10) ?? null,
		end_date: event.endDate?.slice(0, 10) ?? null,
		start_time: extractTimeFromIso(event.startDate),
		locality,
		event_url: event.url ?? null,
		image_url: event.image ?? null,
		tags: ['sup'],
		organizer: event.organizer ?? null,
		responsible_person: event.organizer ?? null,
		max_participants: event.maxAttendees ?? null,
		price,
		latitude: event.latitude ?? null,
		longitude: event.longitude ?? null,
		// Struktureret opmærkning er langt mere pålidelig end fritekst.
		confidence: 92,
		evidence: 'schema.org/Event i sidens JSON-LD'
	};
}

function extractTimeFromIso(iso: string | undefined): string | null {
	if (!iso) return null;
	const match = iso.match(/T(\d{2}):(\d{2})/);
	return match ? `${match[1]}:${match[2]}` : null;
}

// ─── AI-udtrækning ────────────────────────────────────────────────────────────

async function extractWithAi(
	page: PageExtract,
	sourceUrl: string,
	config: AiScraperConfig,
	options: ScrapeEventOptions,
	notes: string[]
): Promise<RawExtractedEvent[]> {
	const prompt = buildExtractionPrompt(page, sourceUrl, options);

	let text: string;
	try {
		text = await generateAiText(prompt, config);
	} catch (e) {
		notes.push(`AI-kald fejlede: ${e instanceof Error ? e.message : String(e)}`);
		return [];
	}

	const parsed = parseJsonArray(text);
	if (!parsed) {
		notes.push('AI-svaret kunne ikke parses som JSON-array');
		return [];
	}

	return parsed.filter((item): item is RawExtractedEvent => !!item && typeof item === 'object');
}

function buildExtractionPrompt(
	page: PageExtract,
	sourceUrl: string,
	options: ScrapeEventOptions
): string {
	const today = new Date().toISOString().slice(0, 10);

	const structuredBlock =
		page.structuredEvents.length > 0
			? `\nSiden indeholder struktureret opmærkning (schema.org). Brug den som facit for de\narrangementer den dækker, og find derudover events der KUN står i brødteksten:\n${JSON.stringify(page.structuredEvents.slice(0, 10), null, 1)}\n`
			: '';

	const customBlock = options.instructions?.trim()
		? `\nEkstra instruktioner fra admin (vejer tungt):\n${options.instructions.trim()}\n`
		: '';

	return `Du udtrækker SUP-arrangementer (Stand Up Paddleboard) fra en dansk webside.

Kilde-URL: ${sourceUrl}
Sidetitel: ${page.pageTitle ?? '(ukendt)'}
Dags dato: ${today}
${structuredBlock}${customBlock}
Sidens indhold (links står som [tekst](url), maskindatoer i parentes):
---
${page.text}
---

REGLER
1. Udtræk kun KONKRETE arrangementer: en aktivitet med et tidspunkt man kan møde op til.
   Menupunkter, kategorier, generel klubinfo og produktomtaler er IKKE arrangementer.
2. Datoer: brug den maskinlæsbare dato i parentes hvis den findes. Ellers gengiv datoen
   præcis som den står på siden — gæt ALDRIG et årstal du ikke har belæg for.
   Kan du ikke finde en dato, sæt start_date til null.
3. Medtag kun arrangementer den ${today} eller senere.
4. external_url: brug linket til det konkrete arrangement hvis siden har et
   (fra [tekst](url)-notationen). Ellers null.
5. confidence: 0-100. Hvor sikker er du på at det er et reelt, kommende SUP-arrangement?
   Under 50 hvis dato eller sted er gættet. Vær ærlig — lav konfidens filtreres fra.
6. evidence: den korte tekststump fra siden der beviser det er et arrangement.

Returner KUN et JSON-array:
[
  {
    "title": "Arrangementets navn",
    "description": "Hvad går det ud på (maks 300 tegn)",
    "start_date": "YYYY-MM-DD eller datoen som den står, eller null",
    "end_date": "samme format, eller null",
    "start_time": "HH:MM eller null",
    "locality": "By/sted i Danmark, eller null",
    "event_url": "URL til arrangementet, eller null",
    "image_url": "URL til billede, eller null",
    "tags": ["sup", "race"],
    "contact_info": "email/telefon, eller null",
    "organizer": "arrangør/klub, eller null",
    "max_participants": tal eller null,
    "price": "fx 250 kr, eller null",
    "distance_km": tal eller null,
    "difficulty": "begynder|øvet|alle, eller null",
    "confidence": 0-100,
    "evidence": "citat fra siden"
  }
]

Findes der ingen arrangementer, returner [].`;
}
