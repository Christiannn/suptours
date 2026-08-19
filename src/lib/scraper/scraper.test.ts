import { describe, it, expect } from 'vitest';
import { parseDanishDate, parseDanishTime, parseDanishDateRange, isUpcoming } from './danishDates';
import { scoreResult, rankResults, dedupeByDomain, extractDomain } from './relevance';
import { buildSearchQueries, buildDeepDiscoveryQueries } from './searchQueries';
import { normalizeEvents, eventIdentity, buildProvenanceNote } from './normalizeEvent';
import {
	extractJsonLdEvents,
	htmlToRichText,
	extractCandidateLinks,
	extractMeta
} from './htmlExtract.server';
import { parseJsonArray } from './webSearch.server';

const REF = new Date('2026-03-01T12:00:00Z');

describe('danishDates', () => {
	it('parser danske månedsnavne med årstal', () => {
		expect(parseDanishDate('12. juni 2026', REF)).toBe('2026-06-12');
		expect(parseDanishDate('d. 3. maj 2027', REF)).toBe('2027-05-03');
		expect(parseDanishDate('1 sep 2026', REF)).toBe('2026-09-01');
	});

	it('gætter førstkommende forekomst når året mangler', () => {
		// Juni er endnu ikke passeret i marts → i år.
		expect(parseDanishDate('14. juni', REF)).toBe('2026-06-14');
		// Januar er passeret → næste år.
		expect(parseDanishDate('20. januar', REF)).toBe('2027-01-20');
	});

	it('parser numeriske formater', () => {
		expect(parseDanishDate('12/6-2026', REF)).toBe('2026-06-12');
		expect(parseDanishDate('12.06.2026', REF)).toBe('2026-06-12');
		expect(parseDanishDate('3/5-26', REF)).toBe('2026-05-03');
	});

	it('accepterer ISO uændret', () => {
		expect(parseDanishDate('2026-06-12T10:00:00Z', REF)).toBe('2026-06-12');
	});

	it('afviser umulige og tomme datoer', () => {
		expect(parseDanishDate('31. februar 2026', REF)).toBeNull();
		expect(parseDanishDate(null, REF)).toBeNull();
		expect(parseDanishDate('ukendt', REF)).toBeNull();
		expect(parseDanishDate('en dejlig sommerdag', REF)).toBeNull();
	});

	it('parser klokkeslæt', () => {
		expect(parseDanishTime('kl. 10')).toBe('10:00');
		expect(parseDanishTime('18.30')).toBe('18:30');
		expect(parseDanishTime('09:05')).toBe('09:05');
		expect(parseDanishTime('kl 25')).toBeNull();
	});

	it('parser datointervaller', () => {
		expect(parseDanishDateRange('14.-16. juni 2026', REF)).toEqual({
			start: '2026-06-14',
			end: '2026-06-16'
		});
	});

	it('afgør om en dato er kommende', () => {
		expect(isUpcoming('2026-06-01', REF)).toBe(true);
		expect(isUpcoming('2026-01-01', REF)).toBe(false);
	});
});

describe('relevance', () => {
	const supEvent = {
		url: 'https://supklub.dk/arrangementer',
		title: 'SUP arrangementer og stævner',
		description: 'Se kalenderen for kommende SUP-ture i Danmark. Tilmelding 12. juni.'
	};
	const webshop = {
		url: 'https://boardshop.dk/produkt/sup-board',
		title: 'Køb SUP board — bedste pris',
		description: 'Tilbud på paddleboards. Fri fragt.'
	};
	const unrelated = {
		url: 'https://nyheder.dk/artikel',
		title: 'Stort stævne i weekenden',
		description: 'Arrangementet foregår i Aarhus den 12. juni 2026.'
	};

	it('scorer en ægte SUP-eventside højt', () => {
		expect(scoreResult(supEvent).score).toBeGreaterThan(30);
	});

	it('straffer webshops', () => {
		expect(scoreResult(webshop).score).toBeLessThan(scoreResult(supEvent).score);
	});

	it('afviser sider helt uden SUP-term', () => {
		expect(scoreResult(unrelated).score).toBeLessThan(0);
	});

	it('rankResults filtrerer under tærsklen og sorterer bedst først', () => {
		const ranked = rankResults([unrelated, supEvent, webshop]);
		expect(ranked[0].result.url).toBe(supEvent.url);
		expect(ranked.map((r) => r.result.url)).not.toContain(unrelated.url);
	});

	it('dedupeByDomain beholder kun de bedste pr. domæne', () => {
		const scored = rankResults([
			supEvent,
			{ ...supEvent, url: 'https://supklub.dk/kalender' },
			{ ...supEvent, url: 'https://anden-klub.dk/events' }
		]);
		const deduped = dedupeByDomain(scored, 1);
		expect(deduped).toHaveLength(2);
	});

	it('extractDomain fjerner www og protokol', () => {
		expect(extractDomain('https://www.SupKlub.dk/a/b')).toBe('supklub.dk');
	});
});

describe('searchQueries', () => {
	it('kurateret strategi giver færre queries end udtømmende', () => {
		const curated = buildSearchQueries({ strategy: 'curated' });
		const exhaustive = buildSearchQueries({ strategy: 'exhaustive' });
		expect(curated.length).toBeLessThan(exhaustive.length);
		expect(curated.length).toBeGreaterThan(0);
	});

	it('lægger admin-queries forrest', () => {
		const queries = buildSearchQueries({ extraQueries: ['min egen query'] });
		expect(queries[0]).toBe('min egen query');
	});

	it('bygger site:-queries for seed-domæner', () => {
		const queries = buildSearchQueries({ strategy: 'curated', seedDomains: ['eksempel.dk'] });
		expect(queries.some((q) => q.includes('site:eksempel.dk'))).toBe(true);
	});

	it('fjerner dubletter', () => {
		const queries = buildSearchQueries({ extraQueries: ['a', 'a', 'A'] });
		expect(queries.filter((q) => q.toLowerCase() === 'a')).toHaveLength(1);
	});

	it('respekterer limit', () => {
		expect(buildSearchQueries({ strategy: 'exhaustive', limit: 5 })).toHaveLength(5);
	});

	it('buildDeepDiscoveryQueries scoper til domænet', () => {
		const queries = buildDeepDiscoveryQueries('https://klub.dk/');
		expect(queries.every((q) => q.includes('site:klub.dk'))).toBe(true);
	});
});

describe('normalizeEvents', () => {
	const base = { sourceUrl: 'https://klub.dk/events', referenceDate: REF };

	it('normaliserer et gyldigt event', () => {
		const { events } = normalizeEvents(
			[{ title: 'Sommertur', start_date: '14. juni 2026', start_time: 'kl. 10', confidence: 90 }],
			base
		);
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			title: 'Sommertur',
			start_date: '2026-06-14',
			start_time: '10:00',
			external_url: 'https://klub.dk/events'
		});
	});

	it('afviser events uden titel, dato eller med lav konfidens', () => {
		const { events, rejected } = normalizeEvents(
			[
				{ title: '', start_date: '2026-06-14' },
				{ title: 'Uden dato', start_date: null },
				{ title: 'Usikker', start_date: '2026-06-14', confidence: 10 }
			],
			base
		);
		expect(events).toHaveLength(0);
		expect(rejected).toHaveLength(3);
	});

	it('afviser datoer i fortiden med mindre includePast er sat', () => {
		const past = [{ title: 'Gammel tur', start_date: '2026-01-05' }];
		expect(normalizeEvents(past, base).events).toHaveLength(0);
		expect(normalizeEvents(past, { ...base, requireUpcoming: false }).events).toHaveLength(1);
	});

	it('fjerner dubletter på samme side', () => {
		const { events, rejected } = normalizeEvents(
			[
				{ title: 'Sommertur', start_date: '2026-06-14' },
				{ title: 'sommertur', start_date: '2026-06-14' }
			],
			base
		);
		expect(events).toHaveLength(1);
		expect(rejected[0].reason).toContain('Dublet');
	});

	it('skalerer konfidens angivet som 0-1', () => {
		const { events } = normalizeEvents(
			[{ title: 'Tur', start_date: '2026-06-14', confidence: 0.9 }],
			base
		);
		expect(events[0].confidence).toBe(90);
	});

	it('tilføjer altid sup-tag og rydder op i de øvrige', () => {
		const { events } = normalizeEvents(
			[{ title: 'Tur', start_date: '2026-06-14', tags: ['#Race', 'x', 'Begynder'] }],
			base
		);
		expect(events[0].tags).toContain('sup');
		expect(events[0].tags).toContain('race');
		expect(events[0].tags).not.toContain('x');
	});

	it('afviser slutdato før startdato', () => {
		const { events } = normalizeEvents(
			[{ title: 'Tur', start_date: '2026-06-14', end_date: '2026-06-01' }],
			base
		);
		expect(events[0].end_date).toBeNull();
	});

	it('afviser koordinater i null island og uden for rækkevidde', () => {
		const { events } = normalizeEvents(
			[{ title: 'Tur', start_date: '2026-06-14', latitude: 0, longitude: 999 }],
			base
		);
		expect(events[0].latitude).toBeNull();
		expect(events[0].longitude).toBeNull();
	});

	it('bruger fallback-billede når eventet ikke har et', () => {
		const { events } = normalizeEvents([{ title: 'Tur', start_date: '2026-06-14' }], {
			...base,
			fallbackImage: 'https://klub.dk/billede.jpg'
		});
		expect(events[0].image_url).toBe('https://klub.dk/billede.jpg');
	});

	it('eventIdentity er stabil på tværs af formatering', () => {
		const a = eventIdentity({ title: 'Sommer Tur!', start_date: '2026-06-14', locality: 'Aarhus' });
		const b = eventIdentity({ title: 'sommer  tur', start_date: '2026-06-14', locality: 'aarhus' });
		expect(a).toBe(b);
	});

	it('provenance-noten indeholder kilde og konfidens', () => {
		const { events } = normalizeEvents(
			[{ title: 'Tur', start_date: '2026-06-14', confidence: 77, price: '250 kr' }],
			base
		);
		const note = buildProvenanceNote(events[0], base.sourceUrl);
		expect(note).toContain(base.sourceUrl);
		expect(note).toContain('77/100');
		expect(note).toContain('250 kr');
	});
});

describe('htmlExtract', () => {
	it('udtrækker schema.org/Event fra JSON-LD', () => {
		const html = `<script type="application/ld+json">${JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'SportsEvent',
			name: 'SUP Race Aarhus',
			startDate: '2026-06-14T10:00:00+02:00',
			location: { name: 'Aarhus Havn', address: { addressLocality: 'Aarhus' } },
			offers: { price: '250', priceCurrency: 'DKK' }
		})}</script>`;

		const events = extractJsonLdEvents(html);
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			name: 'SUP Race Aarhus',
			startDate: '2026-06-14T10:00:00+02:00',
			locationName: 'Aarhus Havn',
			price: '250'
		});
	});

	it('følger @graph og itemListElement', () => {
		const html = `<script type="application/ld+json">${JSON.stringify({
			'@graph': [
				{ '@type': 'WebSite', name: 'Klub' },
				{
					'@type': 'ItemList',
					itemListElement: [
						{
							'@type': 'ListItem',
							item: { '@type': 'Event', name: 'Tur A', startDate: '2026-07-01' }
						}
					]
				}
			]
		})}</script>`;
		expect(extractJsonLdEvents(html).map((e) => e.name)).toEqual(['Tur A']);
	});

	it('ignorerer ugyldig JSON-LD uden at kaste', () => {
		expect(extractJsonLdEvents('<script type="application/ld+json">{ ikke json </script>')).toEqual(
			[]
		);
	});

	it('bevarer links og maskindatoer i brødteksten', () => {
		const html = `<p>Næste tur: <a href="/events/42">Sommertur</a> den
			<time datetime="2026-06-14">lør 14. juni</time>.</p>`;
		const text = htmlToRichText(html, 'https://klub.dk/kalender');
		expect(text).toContain('[Sommertur](https://klub.dk/events/42)');
		expect(text).toContain('(2026-06-14)');
	});

	it('finder kandidat-links på samme domæne', () => {
		const html = `
			<a href="/arrangementer/sommertur">Sommertur</a>
			<a href="https://andet-site.dk/event">Ekstern</a>
			<a href="/om-os">Om os</a>`;
		const links = extractCandidateLinks(html, 'https://klub.dk/');
		expect(links.map((l) => l.url)).toEqual(['https://klub.dk/arrangementer/sommertur']);
	});

	it('læser OpenGraph-meta', () => {
		const html = `<meta property="og:image" content="https://klub.dk/a.jpg">`;
		expect(extractMeta(html, ['og:image'])).toBe('https://klub.dk/a.jpg');
	});
});

describe('parseJsonArray', () => {
	it('finder array i rå tekst', () => {
		expect(parseJsonArray('Her er svaret: [{"a":1}] — håber det hjælper')).toEqual([{ a: 1 }]);
	});

	it('finder array i en kodeblok', () => {
		expect(parseJsonArray('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
	});

	it('returnerer null for uparsbart svar', () => {
		expect(parseJsonArray('beklager, jeg kan ikke')).toBeNull();
	});
});
