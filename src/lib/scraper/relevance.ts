/**
 * relevance.ts
 *
 * Billig heuristisk scoring af søgeresultater, før de sendes til AI'en.
 *
 * Formål: AI-filtret i fase 1 er både det dyreste og det mest skrøbelige
 * led. Ved at pre-score på nøgleord kan vi
 *   1) smide åbenlyst irrelevante resultater væk gratis,
 *   2) sende færre og bedre kandidater til modellen,
 *   3) sortere så de bedste kilder overlever et evt. `maxResults`-loft.
 *
 * Rent modul uden server-afhængigheder.
 */

export interface ScorableResult {
	url: string;
	title: string;
	description: string;
}

export interface ScoredResult<T extends ScorableResult = ScorableResult> {
	result: T;
	score: number;
	/** Kort forklaring – vises i admin og hjælper ved fejlsøgning. */
	reasons: string[];
}

/** Positive signaler: at siden overhovedet handler om SUP. */
const ACTIVITY_PATTERNS: Array<[RegExp, number, string]> = [
	[/\bsup\b/i, 6, 'sup'],
	[/stand[\s-]?up[\s-]?paddle/i, 8, 'stand up paddle'],
	[/paddle[\s-]?board/i, 7, 'paddleboard'],
	[/\bpaddling\b|\bpadling\b/i, 3, 'padling']
];

/** Positive signaler: at siden handler om et arrangement. */
const EVENT_PATTERNS: Array<[RegExp, number, string]> = [
	[/\bstævne\w*/i, 6, 'stævne'],
	[/\barrangement\w*/i, 5, 'arrangement'],
	[/\bkalender\b|\bcalendar\b/i, 5, 'kalender'],
	[/\btilmeld\w*/i, 6, 'tilmelding'],
	[/\bevent\w*/i, 4, 'event'],
	[/\bfællestur\w*|\bfaellestur\w*/i, 5, 'fællestur'],
	[/\brace\b|\bregatta\b/i, 4, 'race'],
	[/\bkursus\b|\bkurser\b|\bworkshop\b/i, 3, 'kursus'],
	[/\bcamp\b|\bfestival\b/i, 3, 'camp/festival'],
	[/\bprogram\b|\baktiviteter\b/i, 3, 'program'],
	[/\bbillet\w*|\bticket\w*/i, 3, 'billetter']
];

/** Positive signaler: dansk geografi/sprog. */
const LOCALE_PATTERNS: Array<[RegExp, number, string]> = [
	[/\bdanmark\b|\bdansk\w*/i, 4, 'danmark'],
	[
		/\b(sjælland|fyn|jylland|bornholm|københavn|aarhus|århus|odense|aalborg|ålborg|esbjerg|roskilde|vejle|kolding|horsens|silkeborg|randers|helsingør|svendborg)\b/i,
		3,
		'dansk by/region'
	],
	[/\b(fjord|limfjorden|øresund|gudenåen|vadehavet|strand|sø|havn)\b/i, 2, 'dansk farvand']
];

/** Datomønstre – stærkt signal om at der ligger konkrete events. */
const DATE_PATTERNS: Array<[RegExp, number, string]> = [
	[/\b\d{1,2}\.\s?(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)/i, 5, 'dansk dato'],
	[/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/, 4, 'numerisk dato'],
	[/\b20(2[4-9]|3\d)\b/, 3, 'årstal']
];

/** Negative signaler: webshops, nyhedsarkiver, irrelevante platforme. */
const NEGATIVE_PATTERNS: Array<[RegExp, number, string]> = [
	[/\b(køb|kob|pris|tilbud|udsalg|rabat|fragt|kurv|webshop|shop)\b/i, -6, 'webshop'],
	[/\/(produkt|product|shop|butik|vare|kategori)\//i, -8, 'produkt-URL'],
	[/\b(test|anmeldelse|bedste \d+|guide til at købe)\b/i, -5, 'anmeldelse/købsguide'],
	[/\b(wikipedia|wikipedia\.org)\b/i, -20, 'wikipedia'],
	[/\b(youtube\.com|tiktok\.com|pinterest\.|reddit\.com)\b/i, -15, 'social/video'],
	[/\b(booking\.com|tripadvisor|airbnb)\b/i, -10, 'rejseportal'],
	[/\/(tag|tags|category|kategori|author)\//i, -4, 'arkivside']
];

/** URL-stier der ofte ER eventsider. */
const URL_BONUS_PATTERNS: Array<[RegExp, number, string]> = [
	[
		/\/(event|events|arrangement|arrangementer|kalender|calendar|aktiviteter|ture|tours)\b/i,
		8,
		'event-sti'
	],
	[/\/(tilmeld|tilmelding|booking|billetter)\b/i, 5, 'tilmeldings-sti'],
	[/\.dk(\/|$)/i, 3, '.dk domæne']
];

/** Alt under denne score kasseres uden at AI'en spørges. */
export const DEFAULT_SCORE_THRESHOLD = 8;

/**
 * Score ét resultat. Titel vægtes højere end beskrivelse, fordi
 * Brave-snippets ofte er afkortet midt i en sætning.
 */
export function scoreResult<T extends ScorableResult>(result: T): ScoredResult<T> {
	const url = result.url ?? '';
	const title = result.title ?? '';
	const description = result.description ?? '';
	const haystack = `${title} ${description}`;

	let score = 0;
	const reasons: string[] = [];

	const apply = (patterns: Array<[RegExp, number, string]>, text: string, weight = 1) => {
		for (const [pattern, points, label] of patterns) {
			if (!pattern.test(text)) continue;
			score += points * weight;
			reasons.push(points >= 0 ? `+${label}` : `-${label}`);
		}
	};

	// Titel tæller dobbelt for de positive kategorier.
	apply(ACTIVITY_PATTERNS, title, 2);
	apply(ACTIVITY_PATTERNS, description, 1);
	apply(EVENT_PATTERNS, title, 2);
	apply(EVENT_PATTERNS, description, 1);
	apply(LOCALE_PATTERNS, haystack, 1);
	apply(DATE_PATTERNS, haystack, 1);
	apply(NEGATIVE_PATTERNS, `${haystack} ${url}`, 1);
	apply(URL_BONUS_PATTERNS, url, 1);

	// Et resultat uden ét eneste SUP-ord er aldrig relevant, uanset
	// hvor mange event- og datoord der ellers står på siden. Straffen
	// skal være stor nok til at overdøve en fuld stribe positive
	// event-signaler — ellers slipper vilkårlige sportskalendere igennem.
	const hasActivity = ACTIVITY_PATTERNS.some(([p]) => p.test(haystack) || p.test(url));
	if (!hasActivity) {
		score -= 40;
		reasons.push('-ingen SUP-term');
	}

	return { result, score, reasons: dedupeReasons(reasons) };
}

/**
 * Score, frasortér under tærskel, og sortér bedste først.
 */
export function rankResults<T extends ScorableResult>(
	results: T[],
	threshold: number = DEFAULT_SCORE_THRESHOLD
): ScoredResult<T>[] {
	return results
		.map(scoreResult)
		.filter((s) => s.score >= threshold)
		.sort((a, b) => b.score - a.score);
}

/**
 * Reducér til én URL pr. domæne og behold den højest scorende.
 *
 * Uden dette ender kilde-listen med 6 stier fra samme klubside,
 * som alle skal godkendes og skrabes hver for sig.
 */
export function dedupeByDomain<T extends ScorableResult>(
	scored: ScoredResult<T>[],
	maxPerDomain = 1
): ScoredResult<T>[] {
	const perDomain = new Map<string, number>();
	const out: ScoredResult<T>[] = [];

	for (const item of [...scored].sort((a, b) => b.score - a.score)) {
		const domain = extractDomain(item.result.url);
		const count = perDomain.get(domain) ?? 0;
		if (count >= maxPerDomain) continue;
		perDomain.set(domain, count + 1);
		out.push(item);
	}

	return out;
}

/** Værtsnavn uden `www.`; falder tilbage til rå streng ved ugyldig URL. */
export function extractDomain(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
	} catch {
		return url.toLowerCase();
	}
}

function dedupeReasons(reasons: string[]): string[] {
	return Array.from(new Set(reasons));
}
