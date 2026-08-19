/**
 * searchQueries.ts
 *
 * Query-katalog til fase 1 (opdagelse af danske SUP-arrangementer).
 *
 * Tidligere brugte scraperen 5 hårdkodede queries, hvilket gav meget lav
 * dækning. Her bygges i stedet et katalog ud fra kombinationer af:
 *   aktivitetsord × eventord × geografi/farvand × sæson
 * plus et sæt kuraterede "høj-præcision" queries.
 *
 * Ingen server-afhængigheder – modulet er rent og unit-testbart.
 */

/** Hvordan queries genereres. */
export type QueryStrategy = 'curated' | 'broad' | 'exhaustive';

/** Ord for selve aktiviteten (dansk + engelsk, med stavevarianter). */
export const ACTIVITY_TERMS = [
	'SUP',
	'stand up paddle',
	'standup paddle',
	'paddleboard',
	'paddle board',
	'SUP board'
] as const;

/** Ord der signalerer et arrangement. */
export const EVENT_TERMS = [
	'arrangement',
	'event',
	'stævne',
	'race',
	'løb',
	'tur',
	'fællestur',
	'kursus',
	'træning',
	'camp',
	'festival',
	'regatta',
	'konkurrence',
	'begynderkursus',
	'weekendtur',
	'kalender',
	'tilmelding'
] as const;

/** Regioner og de største byer. */
export const REGION_TERMS = [
	'Danmark',
	'Sjælland',
	'Fyn',
	'Jylland',
	'Bornholm',
	'Nordjylland',
	'Midtjylland',
	'Sydjylland',
	'København',
	'Aarhus',
	'Odense',
	'Aalborg',
	'Esbjerg',
	'Roskilde',
	'Vejle',
	'Kolding',
	'Horsens',
	'Silkeborg',
	'Randers',
	'Helsingør',
	'Svendborg',
	'Skanderborg'
] as const;

/** Danske farvande hvor SUP-events typisk afholdes. */
export const WATER_TERMS = [
	'Limfjorden',
	'Roskilde Fjord',
	'Isefjord',
	'Øresund',
	'Gudenåen',
	'Furesøen',
	'Silkeborgsøerne',
	'Vejle Fjord',
	'Odense Fjord',
	'Mariager Fjord',
	'Vadehavet',
	'Amager Strand',
	'Svanemøllen'
] as const;

/** Organisationstyper der arrangerer SUP i Danmark. */
export const ORGANISER_TERMS = [
	'SUP klub',
	'kajakklub',
	'roklub',
	'surfklub',
	'vandsportsklub',
	'paddle forening',
	'DGI',
	'outdoor center'
] as const;

/**
 * Kuraterede queries med høj præcision. Disse rammer typisk
 * eventkalendere og klub-aktivitetssider direkte.
 */
export const CURATED_QUERIES = [
	'SUP arrangementer Danmark kalender',
	'SUP events Danmark tilmelding',
	'stand up paddle stævne Danmark',
	'SUP race Danmark kalender',
	'paddleboard tur Danmark tilmelding',
	'SUP klub Danmark aktivitetskalender',
	'SUP kursus Danmark datoer',
	'stand up paddleboard fællestur Danmark',
	'SUP camp Danmark weekend',
	'SUP festival Danmark',
	'kajakklub SUP aktiviteter kalender',
	'DGI stand up paddle aktiviteter',
	'SUP begynderkursus Danmark tilmelding',
	'SUP træning klub Danmark tider',
	'paddle event Danmark kommende'
] as const;

/**
 * Domæner der ofte hoster danske SUP-arrangementer.
 * Bruges til `site:`-scopede queries, så vi finder eventsider der
 * ellers rangerer for lavt i almindelig websøgning.
 *
 * Listen er redigerbar fra admin-UI'et – defaults er brede platforme,
 * ikke gæt på specifikke klubdomæner.
 */
export const DEFAULT_SEED_DOMAINS = [
	'dgi.dk',
	'kano-kajak.dk',
	'billetto.dk',
	'eventbrite.dk',
	'facebook.com/events'
] as const;

export interface BuildQueriesOptions {
	strategy?: QueryStrategy;
	/** Ekstra queries fra admin, tilføjes altid forrest. */
	extraQueries?: string[];
	/** Domæner der får `site:`-scopede queries. */
	seedDomains?: string[];
	/** Årstal der tilføjes til en del af de genererede queries. */
	years?: number[];
	/** Hårdt loft på antal queries (beskytter mod API-kvote). */
	limit?: number;
}

/** Standard-loft pr. strategi. */
const STRATEGY_LIMIT: Record<QueryStrategy, number> = {
	curated: 25,
	broad: 45,
	exhaustive: 100
};

/**
 * Byg det endelige sæt søgestrenge.
 *
 * Rækkefølgen er bevidst: admin-queries → site:-scopede → kuraterede →
 * genererede kombinationer. `limit` er et hårdt loft, så det er de mest
 * spekulative kombinationer der ryger først.
 */
export function buildSearchQueries(options: BuildQueriesOptions = {}): string[] {
	const strategy = options.strategy ?? 'broad';
	const limit = options.limit ?? STRATEGY_LIMIT[strategy];
	const years = options.years ?? defaultYears();
	const seeds = (options.seedDomains ?? [...DEFAULT_SEED_DOMAINS])
		.map((d) => d.trim())
		.filter(Boolean);

	// To spande: `priority` overlever altid `limit`, `generated` skæres.
	// Uden den opdeling ville de kuraterede queries alene fylde kvoten
	// for den kuraterede strategi, så seed-domænerne aldrig blev søgt.
	const priority: string[] = [];
	const generated: string[] = [];

	const push = (bucket: string[], q: string) => {
		const trimmed = q.trim().replace(/\s+/g, ' ');
		if (trimmed) bucket.push(trimmed);
	};

	// 1) Admin-definerede queries har altid forrang.
	for (const q of options.extraQueries ?? []) push(priority, q);

	// 2) Site-scopede queries mod kendte platforme. De ligger før de
	//    kuraterede, fordi et lavt `limit` ellers ville skære dem væk —
	//    og en `site:`-query rammer typisk mere præcist end en fri søgning.
	for (const domain of seeds) {
		push(priority, `site:${domain} SUP arrangement`);
		if (strategy !== 'curated') push(priority, `site:${domain} stand up paddle event`);
	}

	// 3) Kuraterede høj-præcisions queries.
	for (const q of CURATED_QUERIES) push(priority, q);

	if (strategy !== 'curated') {
		// 4) Årstals-varianter — fanger "sæson 2026"-kalendere.
		for (const year of years) {
			push(generated, `SUP arrangementer Danmark ${year}`);
			push(generated, `SUP race kalender ${year} Danmark`);
			push(generated, `stand up paddle events ${year} Danmark`);
		}

		// 5) Geografiske kombinationer.
		for (const region of REGION_TERMS) {
			push(generated, `SUP arrangement ${region}`);
			if (strategy === 'exhaustive') {
				push(generated, `stand up paddle event ${region} tilmelding`);
			}
		}
	}

	if (strategy === 'exhaustive') {
		// 6) Farvande — rammer tur-beskrivelser frem for klubforsider.
		for (const water of WATER_TERMS) {
			push(generated, `SUP tur ${water} arrangement`);
		}

		// 7) Arrangørtyper.
		for (const org of ORGANISER_TERMS) {
			push(generated, `${org} SUP arrangementer kalender`);
		}

		// 8) Aktivitet × event-kryds, uden geografi.
		for (const activity of ACTIVITY_TERMS) {
			for (const evt of EVENT_TERMS) {
				push(generated, `${activity} ${evt} Danmark`);
			}
		}
	}

	// `limit` er et hårdt loft — det styrer direkte hvor mange
	// Brave-kald kørslen koster. Rækkefølgen sikrer at det er de mest
	// spekulative kombinationer der ryger først.
	return dedupeQueries([...priority, ...generated]).slice(0, Math.max(1, limit));
}

/**
 * Bygger `site:`-queries til uddybende opdagelse på et domæne vi
 * allerede kender. En klubforside i kilde-listen betyder som regel at
 * der findes flere eventsider på samme domæne.
 */
export function buildDeepDiscoveryQueries(domain: string): string[] {
	const host = domain
		.trim()
		.replace(/^https?:\/\//, '')
		.replace(/\/+$/, '');
	if (!host) return [];
	return [
		`site:${host} SUP`,
		`site:${host} arrangement OR event OR stævne`,
		`site:${host} kalender OR tilmelding`
	];
}

/** Indeværende og næste år — nok til at fange kommende sæson. */
function defaultYears(): number[] {
	const now = new Date().getFullYear();
	return [now, now + 1];
}

function dedupeQueries(queries: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const q of queries) {
		const key = q.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(q);
	}
	return out;
}
