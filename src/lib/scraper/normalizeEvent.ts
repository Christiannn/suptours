/**
 * normalizeEvent.ts
 *
 * Validering, normalisering og konfidens-scoring af AI-udtrukne events,
 * før de bliver til kladder i `tours`.
 *
 * Uden dette led gik AI'ens rå output direkte i databasen. Det gav
 * kladder med ulæselige datoer, tomme titler, dubletter fra samme side,
 * og — værst — events der i virkeligheden var menupunkter eller
 * historiske arrangementer.
 *
 * Rent modul uden server-afhængigheder.
 */

import { parseDanishDate, parseDanishTime, isUpcoming } from './danishDates';

/** Det AI'en (eller JSON-LD) leverer, før validering. */
export interface RawExtractedEvent {
	title?: string | null;
	description?: string | null;
	start_date?: string | null;
	end_date?: string | null;
	start_time?: string | null;
	locality?: string | null;
	event_url?: string | null;
	image_url?: string | null;
	tags?: string[] | null;
	contact_info?: string | null;
	responsible_person?: string | null;
	organizer?: string | null;
	max_participants?: number | string | null;
	price?: string | null;
	distance_km?: number | string | null;
	difficulty?: string | null;
	latitude?: number | string | null;
	longitude?: number | string | null;
	confidence?: number | string | null;
	evidence?: string | null;
}

/** Et valideret event, klar til at blive en kladde. */
export interface NormalizedEvent {
	title: string;
	description: string | null;
	start_date: string;
	end_date: string | null;
	start_time: string | null;
	locality: string | null;
	external_url: string;
	image_url: string | null;
	tags: string[];
	contact_info: string | null;
	responsible_person: string | null;
	max_participants: number | null;
	latitude: number | null;
	longitude: number | null;
	/** 0–100. Under `MIN_CONFIDENCE` afvises eventet. */
	confidence: number;
	/** Hvorfor AI'en mener det er et event — vises til admin. */
	evidence: string | null;
	/** Ekstra felter der ikke har en kolonne, samles i noten. */
	price: string | null;
	distance_km: number | null;
	difficulty: string | null;
	organizer: string | null;
}

export interface RejectedEvent {
	title: string;
	reason: string;
}

export interface NormalizeResult {
	events: NormalizedEvent[];
	rejected: RejectedEvent[];
}

/** Kladder under denne konfidens oprettes ikke. */
export const MIN_CONFIDENCE = 35;

/** Events længere ude end dette er sandsynligvis fejllæste årstal. */
const MAX_MONTHS_AHEAD = 24;

export interface NormalizeOptions {
	/** Fallback-URL når eventet ikke har sin egen. */
	sourceUrl: string;
	/** Fallback-billede fra og:image. */
	fallbackImage?: string | null;
	/** Kræv at datoen ligger i fremtiden. Default true. */
	requireUpcoming?: boolean;
	referenceDate?: Date;
}

/**
 * Normalisér en liste rå events. Returnerer både de godkendte og de
 * afviste, så admin kan se hvad der blev filtreret fra og hvorfor.
 */
export function normalizeEvents(
	raw: RawExtractedEvent[],
	options: NormalizeOptions
): NormalizeResult {
	const referenceDate = options.referenceDate ?? new Date();
	const requireUpcoming = options.requireUpcoming ?? true;

	const events: NormalizedEvent[] = [];
	const rejected: RejectedEvent[] = [];
	const seen = new Set<string>();

	for (const item of raw ?? []) {
		const title = cleanText(item.title);
		if (!title || title.length < 3) {
			rejected.push({ title: title || '(uden titel)', reason: 'Manglende eller for kort titel' });
			continue;
		}

		const startDate = parseDanishDate(item.start_date, referenceDate);
		if (!startDate) {
			rejected.push({ title, reason: 'Ingen brugbar startdato' });
			continue;
		}

		if (requireUpcoming && !isUpcoming(startDate, referenceDate)) {
			rejected.push({ title, reason: `Dato i fortiden (${startDate})` });
			continue;
		}

		if (isTooFarAhead(startDate, referenceDate)) {
			rejected.push({ title, reason: `Dato urealistisk langt ude (${startDate})` });
			continue;
		}

		const confidence = clampConfidence(item.confidence);
		if (confidence < MIN_CONFIDENCE) {
			rejected.push({ title, reason: `Lav konfidens (${confidence})` });
			continue;
		}

		// Dubletter inden for samme side: samme titel + dato er samme event.
		const key = `${title.toLowerCase().replace(/\s+/g, ' ')}|${startDate}`;
		if (seen.has(key)) {
			rejected.push({ title, reason: 'Dublet på siden' });
			continue;
		}
		seen.add(key);

		let endDate = parseDanishDate(item.end_date, referenceDate);
		// En slutdato før startdatoen er altid en fejllæsning.
		if (endDate && endDate < startDate) endDate = null;

		events.push({
			title: title.slice(0, 200),
			description: cleanText(item.description)?.slice(0, 2000) ?? null,
			start_date: startDate,
			end_date: endDate,
			start_time: parseDanishTime(item.start_time),
			locality: cleanText(item.locality)?.slice(0, 200) ?? null,
			external_url: cleanUrl(item.event_url) ?? options.sourceUrl,
			image_url: cleanUrl(item.image_url) ?? options.fallbackImage ?? null,
			tags: normalizeTags(item.tags),
			contact_info: cleanText(item.contact_info)?.slice(0, 500) ?? null,
			responsible_person: cleanText(item.responsible_person) ?? cleanText(item.organizer) ?? null,
			max_participants: toPositiveInt(item.max_participants),
			latitude: toCoordinate(item.latitude, 90),
			longitude: toCoordinate(item.longitude, 180),
			confidence,
			evidence: cleanText(item.evidence)?.slice(0, 500) ?? null,
			price: cleanText(item.price)?.slice(0, 100) ?? null,
			distance_km: toPositiveNumber(item.distance_km),
			difficulty: cleanText(item.difficulty)?.slice(0, 50) ?? null,
			organizer: cleanText(item.organizer)?.slice(0, 200) ?? null
		});
	}

	return { events, rejected };
}

/**
 * Byg den `security_notes`-tekst kladden får med.
 * Admin skal kunne se hvor tallene kommer fra uden at åbne kilden.
 */
export function buildProvenanceNote(event: NormalizedEvent, sourceUrl: string): string {
	const lines = [`Automatisk udtrukket fra ${sourceUrl}`, `Konfidens: ${event.confidence}/100`];

	if (event.evidence) lines.push(`Grundlag: ${event.evidence}`);
	if (event.price) lines.push(`Pris: ${event.price}`);
	if (event.distance_km !== null) lines.push(`Distance: ${event.distance_km} km`);
	if (event.difficulty) lines.push(`Niveau: ${event.difficulty}`);
	if (event.organizer) lines.push(`Arrangør: ${event.organizer}`);

	lines.push('Kontrollér detaljer mod kilden før publicering.');
	return lines.join('\n');
}

/**
 * Nøgle til at genkende det samme event på tværs af kørsler, så en ny
 * skrabning opdaterer i stedet for at oprette en dublet.
 */
export function eventIdentity(event: {
	title: string;
	start_date: string;
	locality?: string | null;
}): string {
	const title = event.title
		.toLowerCase()
		.replace(/[^a-z0-9æøå]+/gi, ' ')
		.trim();
	const locality = (event.locality ?? '')
		.toLowerCase()
		.replace(/[^a-z0-9æøå]+/gi, ' ')
		.trim();
	return `${title}|${event.start_date}|${locality}`;
}

// ─── Hjælpere ─────────────────────────────────────────────────────────────────

function cleanText(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim().replace(/\s+/g, ' ');
	if (!trimmed || /^(null|undefined|n\/a|ukendt|-)$/i.test(trimmed)) return null;
	return trimmed;
}

function cleanUrl(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	try {
		const url = new URL(trimmed);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
	} catch {
		return null;
	}
}

function normalizeTags(tags: unknown): string[] {
	const list = Array.isArray(tags) ? tags : [];
	const cleaned = list
		.filter((t): t is string => typeof t === 'string')
		.map((t) => t.trim().toLowerCase().replace(/^#/, ''))
		.filter((t) => t.length > 1 && t.length <= 30);
	// 'sup' er altid relevant og gør kladderne filtrerbare på siden.
	return Array.from(new Set(['sup', ...cleaned])).slice(0, 10);
}

function clampConfidence(value: unknown): number {
	const n = typeof value === 'string' ? Number(value) : value;
	// Manglende konfidens behandles som "middel", ikke som afvisning —
	// ældre prompts og JSON-LD leverer ikke feltet.
	if (typeof n !== 'number' || !Number.isFinite(n)) return 60;
	// Modeller svarer nogle gange 0–1 i stedet for 0–100.
	const scaled = n > 0 && n <= 1 ? n * 100 : n;
	return Math.max(0, Math.min(100, Math.round(scaled)));
}

function toPositiveInt(value: unknown): number | null {
	const n = typeof value === 'string' ? Number(value) : value;
	if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
	return Math.min(100_000, Math.round(n));
}

function toPositiveNumber(value: unknown): number | null {
	const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
	if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
	return Math.round(n * 10) / 10;
}

function toCoordinate(value: unknown, max: number): number | null {
	const n = typeof value === 'string' ? Number(value) : value;
	if (typeof n !== 'number' || !Number.isFinite(n)) return null;
	if (Math.abs(n) > max) return null;
	// 0,0 er "null island" og betyder i praksis manglende data.
	if (n === 0) return null;
	return n;
}

function isTooFarAhead(isoDate: string, referenceDate: Date): boolean {
	const limit = new Date(referenceDate);
	limit.setMonth(limit.getMonth() + MAX_MONTHS_AHEAD);
	return isoDate > limit.toISOString().slice(0, 10);
}
