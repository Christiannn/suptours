/**
 * htmlExtract.server.ts
 *
 * Strukturel udtrækning fra en hentet HTML-side.
 *
 * Den tidligere implementering strippede *alle* tags og sendte 10k tegn
 * rå tekst til AI'en. Det kastede tre ting væk som er afgørende for
 * kvaliteten af kladderne:
 *
 *   1. `application/ld+json` med schema.org/Event — struktureret,
 *      maskinlæsbar sandhed om dato, sted, pris og arrangør. De fleste
 *      event- og billetplatforme udsender det.
 *   2. `<a href>` — uden links kan AI'en ikke pege på den konkrete
 *      eventside, så alle kladder fik kalendersidens URL.
 *   3. `<time datetime="...">` — den eksakte maskin-dato, i stedet for
 *      den menneskelige "lør. d. 3." der skal gættes ud fra.
 *
 * Her udtrækkes alle tre dele, og brødteksten isoleres fra nav/footer
 * før den beskæres.
 */

/** Et schema.org/Event fundet i JSON-LD eller microdata. */
export interface StructuredEvent {
	name?: string;
	description?: string;
	startDate?: string;
	endDate?: string;
	url?: string;
	image?: string;
	locationName?: string;
	locationAddress?: string;
	latitude?: number;
	longitude?: number;
	organizer?: string;
	price?: string;
	currency?: string;
	maxAttendees?: number;
}

export interface PageExtract {
	/** Titel fra <title> eller og:title. */
	pageTitle: string | null;
	/** og:description eller meta description. */
	pageDescription: string | null;
	/** og:image — brugbar som fallback-billede på kladden. */
	pageImage: string | null;
	/** Sproget siden erklærer (`da` er et positivt signal). */
	lang: string | null;
	/** schema.org/Event-objekter fundet i JSON-LD. */
	structuredEvents: StructuredEvent[];
	/** Brødtekst med links og datoer bevaret. */
	text: string;
	/** Interne links der ligner eventsider — kandidater til dybde-crawl. */
	candidateLinks: Array<{ url: string; text: string }>;
}

const TEXT_BUDGET = 24_000;

/**
 * Hovedindgang: parse HTML til det AI'en skal bruge.
 */
export function extractPage(html: string, baseUrl: string): PageExtract {
	const structuredEvents = extractJsonLdEvents(html);
	const main = isolateMainContent(html);

	return {
		pageTitle: extractTitle(html),
		pageDescription: extractMeta(html, ['og:description', 'description', 'twitter:description']),
		pageImage: absolutize(extractMeta(html, ['og:image', 'twitter:image']), baseUrl),
		lang: extractLang(html),
		structuredEvents,
		text: htmlToRichText(main, baseUrl).slice(0, TEXT_BUDGET),
		candidateLinks: extractCandidateLinks(main, baseUrl)
	};
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────

/**
 * Find alle schema.org/Event i `<script type="application/ld+json">`.
 * Håndterer `@graph`, arrays, og indlejrede `subEvent`.
 */
export function extractJsonLdEvents(html: string): StructuredEvent[] {
	const blocks = [
		...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
	];

	const events: StructuredEvent[] = [];

	for (const block of blocks) {
		const raw = block[1]?.trim();
		if (!raw) continue;
		let parsed: unknown;
		try {
			parsed = JSON.parse(stripJsonComments(raw));
		} catch {
			continue; // Ugyldig JSON-LD er almindeligt; spring over uden at fejle.
		}
		collectEvents(parsed, events);
	}

	return events;
}

/**
 * Er `@type` et Event? Dækker undertyper som SportsEvent og
 * SocialEvent, og `@type` kan lovligt være et array.
 */
function isEventType(type: unknown): boolean {
	const types = Array.isArray(type) ? type : [type];
	return types.some((t) => typeof t === 'string' && /event$/i.test(t.trim()));
}

function collectEvents(node: unknown, out: StructuredEvent[], depth = 0): void {
	if (!node || depth > 6) return;

	if (Array.isArray(node)) {
		for (const item of node) collectEvents(item, out, depth + 1);
		return;
	}

	if (typeof node !== 'object') return;
	const obj = node as Record<string, unknown>;

	if (Array.isArray(obj['@graph'])) {
		collectEvents(obj['@graph'], out, depth + 1);
	}

	if (isEventType(obj['@type'])) {
		out.push(toStructuredEvent(obj));
	}

	// Nogle sider pakker events i itemListElement eller subEvent.
	for (const key of ['itemListElement', 'subEvent', 'event', 'events']) {
		if (obj[key]) collectEvents(obj[key], out, depth + 1);
	}
	// ListItem-wrapper: { "@type": "ListItem", "item": {...} }
	if (obj.item) collectEvents(obj.item, out, depth + 1);
}

function toStructuredEvent(obj: Record<string, unknown>): StructuredEvent {
	const location = obj.location as Record<string, unknown> | undefined;
	const address = location?.address as Record<string, unknown> | string | undefined;
	const geo = location?.geo as Record<string, unknown> | undefined;
	const offers = firstOf(obj.offers) as Record<string, unknown> | undefined;
	const organizer = firstOf(obj.organizer) as Record<string, unknown> | string | undefined;

	return {
		name: str(obj.name),
		description: str(obj.description),
		startDate: str(obj.startDate),
		endDate: str(obj.endDate),
		url: str(obj.url),
		image: extractImageUrl(obj.image),
		locationName: str(location?.name),
		locationAddress: formatAddress(address),
		latitude: num(geo?.latitude),
		longitude: num(geo?.longitude),
		organizer: typeof organizer === 'string' ? organizer : str(organizer?.name),
		price: str(offers?.price),
		currency: str(offers?.priceCurrency),
		maxAttendees: num(obj.maximumAttendeeCapacity)
	};
}

function formatAddress(address: Record<string, unknown> | string | undefined): string | undefined {
	if (!address) return undefined;
	if (typeof address === 'string') return address;
	const parts = [
		str(address.streetAddress),
		str(address.postalCode),
		str(address.addressLocality),
		str(address.addressRegion)
	].filter(Boolean);
	return parts.length ? parts.join(', ') : undefined;
}

/** `image` kan være en streng, et ImageObject, eller et array af begge. */
function extractImageUrl(value: unknown): string | undefined {
	const first = firstOf(value);
	if (typeof first === 'string') return str(first);
	if (first && typeof first === 'object') {
		return str((first as Record<string, unknown>).url);
	}
	return undefined;
}

function firstOf(value: unknown): unknown {
	return Array.isArray(value) ? value[0] : value;
}

function str(value: unknown): string | undefined {
	if (typeof value === 'string' && value.trim()) return value.trim();
	if (typeof value === 'number') return String(value);
	return undefined;
}

function num(value: unknown): number | undefined {
	const n = typeof value === 'string' ? Number(value) : value;
	return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

/** Nogle CMS'er indsætter // kommentarer i JSON-LD, hvilket bryder JSON.parse. */
function stripJsonComments(raw: string): string {
	return raw.replace(/^\s*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
}

// ─── Meta / titel ─────────────────────────────────────────────────────────────

function extractTitle(html: string): string | null {
	const og = extractMeta(html, ['og:title', 'twitter:title']);
	if (og) return og;
	const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	return match ? decodeEntities(match[1]).trim() || null : null;
}

/** Læs det første meta-tag der matcher et af de givne navne. */
export function extractMeta(html: string, names: string[]): string | null {
	for (const name of names) {
		const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const pattern = new RegExp(
			`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
			'i'
		);
		const alt = new RegExp(
			`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`,
			'i'
		);
		const match = html.match(pattern) ?? html.match(alt);
		const value = match?.[1] && decodeEntities(match[1]).trim();
		if (value) return value;
	}
	return null;
}

function extractLang(html: string): string | null {
	const match = html.match(/<html[^>]+lang=["']([a-z-]+)["']/i);
	return match ? match[1].toLowerCase() : null;
}

// ─── Brødtekst ────────────────────────────────────────────────────────────────

/**
 * Fjern nav, header, footer, sidebar og cookiebannere, og behold
 * `<main>`/`<article>` hvis siden har et.
 */
export function isolateMainContent(html: string): string {
	const cleaned = html
		.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
		.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
		.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<(nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');

	// Foretræk hovedindholdet hvis det er markeret op og har substans.
	const main = cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
	if (main && main[1].length > 400) return main[1];

	const article = cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
	if (article && article[1].length > 400) return article[1];

	return cleaned;
}

/**
 * HTML → tekst hvor links og maskin-datoer bevares.
 *
 * Links bliver `[tekst](url)` og `<time datetime>` bliver
 * `tekst (2026-06-12)`, så AI'en kan citere den præcise værdi i stedet
 * for at fortolke visuel formatering.
 */
export function htmlToRichText(html: string, baseUrl: string): string {
	let text = html;

	// <time datetime="2026-06-12">lør 12. juni</time> → "lør 12. juni (2026-06-12)"
	text = text.replace(
		/<time[^>]+datetime=["']([^"']+)["'][^>]*>([\s\S]*?)<\/time>/gi,
		(_m, dt: string, inner: string) => `${stripTags(inner)} (${dt.trim()})`
	);

	// <a href="/events/x">Sommertur</a> → "[Sommertur](https://.../events/x)"
	text = text.replace(
		/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
		(_m, href: string, inner: string) => {
			const label = stripTags(inner).trim();
			if (!label) return ' ';
			const abs = absolutize(href, baseUrl);
			return abs ? `[${label}](${abs})` : label;
		}
	);

	// Bevar blokstruktur som linjeskift, så lister ikke smelter sammen.
	text = text
		.replace(/<\/(p|div|li|tr|h[1-6]|section|table)>/gi, '\n')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<li\b[^>]*>/gi, '\n• ');

	return decodeEntities(stripTags(text))
		.replace(/[ \t\u00A0]+/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.split('\n')
		.map((line) => line.trim())
		.filter((line, i, arr) => line.length > 0 || arr[i - 1]?.length > 0)
		.join('\n')
		.trim();
}

/**
 * Interne links hvis URL eller linktekst ligner en eventside.
 * Bruges til dybde-1 crawl fra en kalenderside til de enkelte events.
 */
export function extractCandidateLinks(
	html: string,
	baseUrl: string,
	limit = 12
): Array<{ url: string; text: string }> {
	const eventish =
		/(event|arrangement|kalender|calendar|aktivitet|tilmeld|booking|tur|race|st[æa]vne|kursus|camp)/i;

	let host = '';
	try {
		host = new URL(baseUrl).hostname;
	} catch {
		return [];
	}

	const seen = new Set<string>();
	const out: Array<{ url: string; text: string }> = [];

	for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
		const label = stripTags(match[2]).trim();
		const abs = absolutize(match[1], baseUrl);
		if (!abs || !label) continue;

		let parsed: URL;
		try {
			parsed = new URL(abs);
		} catch {
			continue;
		}
		// Kun samme domæne — vi vil ikke crawle ud på hele nettet.
		if (parsed.hostname !== host) continue;
		if (!eventish.test(parsed.pathname) && !eventish.test(label)) continue;

		const key = parsed.toString().replace(/#.*$/, '');
		if (seen.has(key)) continue;
		seen.add(key);

		out.push({ url: key, text: label.slice(0, 120) });
		if (out.length >= limit) break;
	}

	return out;
}

// ─── Hjælpere ─────────────────────────────────────────────────────────────────

function stripTags(html: string): string {
	return html.replace(/<[^>]+>/g, ' ');
}

export function absolutize(href: string | null | undefined, baseUrl: string): string | null {
	if (!href) return null;
	const trimmed = href.trim();
	if (!trimmed || trimmed.startsWith('#')) return null;
	if (/^(javascript|mailto|tel):/i.test(trimmed)) return null;
	try {
		return new URL(trimmed, baseUrl).toString();
	} catch {
		return null;
	}
}

const ENTITIES: Record<string, string> = {
	nbsp: ' ',
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	aring: 'å',
	Aring: 'Å',
	aelig: 'æ',
	AElig: 'Æ',
	oslash: 'ø',
	Oslash: 'Ø',
	eacute: 'é',
	hellip: '…',
	ndash: '–',
	mdash: '—',
	laquo: '«',
	raquo: '»',
	bull: '•',
	deg: '°',
	euro: '€',
	copy: '©'
};

export function decodeEntities(text: string): string {
	return text
		.replace(/&#(\d+);/g, (_m, code: string) => safeCodePoint(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => safeCodePoint(parseInt(hex, 16)))
		.replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name] ?? m);
}

function safeCodePoint(code: number): string {
	if (!Number.isFinite(code) || code < 1 || code > 0x10ffff) return '';
	try {
		return String.fromCodePoint(code);
	} catch {
		return '';
	}
}
