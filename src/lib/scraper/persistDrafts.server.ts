/**
 * persistDrafts.server.ts
 *
 * Gemmer validerede events som kladder i `tours` + provenance i
 * `scraper_draft_meta`.
 *
 * Deles af `/api/scraper/extract` (én URL) og `/api/scraper/scrape`
 * (alle aktive kilder), så de to veje ikke kan komme til at gemme
 * forskelligt.
 *
 * Dedup-strategi: et event genkendes på (titel, startdato, sted).
 * Findes det allerede som kladde, opdateres kladden. Findes det som
 * *publiceret* tur, springes det over — vi vil aldrig overskrive noget
 * admin allerede har godkendt og rettet til.
 */

import type { createServerClient } from '@supabase/ssr';
import type { Database } from '$lib/database.types';
import { buildProvenanceNote, eventIdentity, type NormalizedEvent } from './normalizeEvent';

type SupabaseClient = ReturnType<typeof createServerClient<Database>>;

export interface PersistResult {
	created: number;
	updated: number;
	skipped: number;
	errors: string[];
}

export interface PersistOptions {
	supabase: SupabaseClient;
	creatorId: string;
	sourceUrl: string;
	sourceId?: string | null;
	/** Slet tidligere kladder fra samme URL som ikke længere findes på siden. */
	pruneStale?: boolean;
}

export async function persistDrafts(
	events: NormalizedEvent[],
	options: PersistOptions
): Promise<PersistResult> {
	const { supabase, creatorId, sourceUrl, sourceId = null } = options;
	const result: PersistResult = { created: 0, updated: 0, skipped: 0, errors: [] };

	// Hvad har vi allerede fra denne kilde?
	const { data: existingMeta } = await supabase
		.from('scraper_draft_meta')
		.select('tour_id, identity_key, tours(id, status)')
		.eq('source_url', sourceUrl);

	const byIdentity = new Map<string, { tourId: string; status: string }>();
	for (const row of existingMeta ?? []) {
		const tour = row.tours as unknown as { id: string; status: string } | null;
		if (!row.identity_key || !tour) continue;
		byIdentity.set(row.identity_key, { tourId: tour.id, status: tour.status });
	}

	const keptTourIds = new Set<string>();

	for (const event of events) {
		const identity = eventIdentity(event);
		const existing = byIdentity.get(identity);

		// Admin har allerede taget stilling — rør den ikke.
		if (existing && existing.status !== 'draft') {
			keptTourIds.add(existing.tourId);
			result.skipped += 1;
			continue;
		}

		const payload = toTourPayload(event, creatorId, sourceUrl);

		if (existing) {
			const { error } = await supabase
				.from('tours')
				.update(payload)
				.eq('id', existing.tourId)
				.eq('status', 'draft');

			if (error) {
				result.errors.push(`${event.title}: ${error.message}`);
				continue;
			}
			await upsertMeta(supabase, existing.tourId, event, sourceUrl, sourceId, identity);
			keptTourIds.add(existing.tourId);
			result.updated += 1;
			continue;
		}

		// Findes eventet allerede som en manuelt oprettet/publiceret tur?
		if (await hasPublishedTwin(supabase, event)) {
			result.skipped += 1;
			continue;
		}

		const { data: inserted, error } = await supabase
			.from('tours')
			.insert(payload)
			.select('id')
			.single();

		if (error || !inserted) {
			result.errors.push(`${event.title}: ${error?.message ?? 'insert fejlede'}`);
			continue;
		}

		await upsertMeta(supabase, inserted.id, event, sourceUrl, sourceId, identity);
		keptTourIds.add(inserted.id);
		result.created += 1;
	}

	// Kladder fra denne kilde der ikke længere står på siden er som
	// regel afholdt eller aflyst. Kun kladder ryddes — aldrig publicerede.
	if (options.pruneStale) {
		const stale = (existingMeta ?? [])
			.map((row) => row.tours as unknown as { id: string; status: string } | null)
			.filter((t): t is { id: string; status: string } => !!t)
			.filter((t) => t.status === 'draft' && !keptTourIds.has(t.id))
			.map((t) => t.id);

		if (stale.length > 0) {
			await supabase.from('tours').delete().in('id', stale).eq('status', 'draft');
		}
	}

	return result;
}

/** Map et normaliseret event til kolonnerne i `tours`. */
function toTourPayload(event: NormalizedEvent, creatorId: string, sourceUrl: string) {
	return {
		creator_id: creatorId,
		title: event.title,
		description: event.description,
		start_date: event.start_date,
		end_date: event.end_date,
		start_time: event.start_time,
		locality: event.locality,
		latitude: event.latitude,
		longitude: event.longitude,
		image_url: event.image_url,
		external_url: event.external_url,
		tags: event.tags,
		contact_info: event.contact_info,
		responsible_person: event.responsible_person,
		max_participants: event.max_participants,
		security_notes: buildProvenanceNote(event, sourceUrl),
		source: 'web' as const,
		status: 'draft' as const
	};
}

async function upsertMeta(
	supabase: SupabaseClient,
	tourId: string,
	event: NormalizedEvent,
	sourceUrl: string,
	sourceId: string | null,
	identityKey: string
): Promise<void> {
	await supabase.from('scraper_draft_meta').upsert(
		{
			tour_id: tourId,
			source_url: sourceUrl,
			source_id: sourceId,
			confidence: event.confidence,
			evidence: event.evidence,
			price: event.price,
			distance_km: event.distance_km,
			difficulty: event.difficulty,
			organizer: event.organizer,
			identity_key: identityKey,
			extracted_at: new Date().toISOString()
		},
		{ onConflict: 'tour_id' }
	);
}

/**
 * Er der allerede en publiceret tur samme dag med (næsten) samme titel?
 * Beskytter mod at scraperen dublerer ture admin selv har oprettet.
 */
async function hasPublishedTwin(
	supabase: SupabaseClient,
	event: NormalizedEvent
): Promise<boolean> {
	const { data } = await supabase
		.from('tours')
		.select('id, title')
		.eq('start_date', event.start_date)
		.neq('status', 'draft')
		.limit(50);

	if (!data || data.length === 0) return false;

	const target = simplify(event.title);
	return data.some((row) => {
		const other = simplify(row.title);
		return other === target || other.includes(target) || target.includes(other);
	});
}

function simplify(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9æøå]+/gi, ' ')
		.trim();
}
