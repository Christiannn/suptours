/**
 * danishDates.ts
 *
 * Normalisering af danske dato- og tidsangivelser til ISO.
 *
 * AI'en returnerer ofte dato-strenge i det format der stod på siden
 * ("12. juni", "3/5-2026", "lørdag d. 14. marts kl. 10"). Uden en
 * normalisering ender de enten som ugyldige `date`-værdier i Postgres
 * eller — værre — som forkerte datoer fordi året blev gættet.
 *
 * Rent modul uden server-afhængigheder.
 */

const MONTHS: Record<string, number> = {
	januar: 1,
	jan: 1,
	februar: 2,
	feb: 2,
	marts: 3,
	mar: 3,
	april: 4,
	apr: 4,
	maj: 5,
	juni: 6,
	jun: 6,
	juli: 7,
	jul: 7,
	august: 8,
	aug: 8,
	september: 9,
	sep: 9,
	sept: 9,
	oktober: 10,
	okt: 10,
	november: 11,
	nov: 11,
	december: 12,
	dec: 12
};

/** ISO-dato `YYYY-MM-DD`, eller null hvis input ikke kan tolkes sikkert. */
export function parseDanishDate(
	raw: string | null | undefined,
	referenceDate = new Date()
): string | null {
	if (!raw) return null;
	const text = String(raw).trim().toLowerCase();
	if (!text || text === 'null' || text === 'ukendt') return null;

	// Allerede ISO: 2026-06-12 (evt. med klokkeslæt bagefter)
	const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (iso) return validIsoOrNull(Number(iso[1]), Number(iso[2]), Number(iso[3]));

	// "12. juni 2026" / "12 juni 2026" / "d. 12. juni" / "12. jun"
	const named = text.match(
		/(?:d\.?\s*)?(\d{1,2})\.?\s*(januar|jan|februar|feb|marts|mar|april|apr|maj|juni|jun|juli|jul|august|aug|september|sept|sep|oktober|okt|november|nov|december|dec)\.?(?:\s*(\d{4}))?/
	);
	if (named) {
		const day = Number(named[1]);
		const month = MONTHS[named[2]];
		const year = named[3] ? Number(named[3]) : inferYear(month, day, referenceDate);
		return validIsoOrNull(year, month, day);
	}

	// "12/6-2026", "12/6 2026", "12-06-2026", "12.06.2026", "12/6"
	const numeric = text.match(/(\d{1,2})[./-](\d{1,2})(?:[./\s-](\d{2,4}))?/);
	if (numeric) {
		const day = Number(numeric[1]);
		const month = Number(numeric[2]);
		let year: number;
		if (numeric[3]) {
			const rawYear = Number(numeric[3]);
			year = rawYear < 100 ? 2000 + rawYear : rawYear;
		} else {
			year = inferYear(month, day, referenceDate);
		}
		return validIsoOrNull(year, month, day);
	}

	return null;
}

/** Klokkeslæt `HH:MM`, eller null. Accepterer "kl. 10", "10.30", "10:30", "18". */
export function parseDanishTime(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const text = String(raw).trim().toLowerCase();
	if (!text || text === 'null') return null;

	const match = text.match(/(?:kl\.?\s*)?(\d{1,2})(?:[.:](\d{2}))?/);
	if (!match) return null;

	const hours = Number(match[1]);
	const minutes = match[2] ? Number(match[2]) : 0;
	if (hours > 23 || minutes > 59) return null;

	return `${pad(hours)}:${pad(minutes)}`;
}

/**
 * Når året mangler på siden ("Sommertur d. 14. juni") antages den
 * førstkommende forekomst af den dato. En dato der lige er passeret
 * tolkes altså som næste år, hvilket er det rigtige gæt for en
 * eventkalender.
 */
function inferYear(month: number, day: number, referenceDate: Date): number {
	const year = referenceDate.getUTCFullYear();
	const candidate = Date.UTC(year, month - 1, day);
	// Lille tolerance så et event i går ikke skubbes et helt år frem.
	const cutoff = referenceDate.getTime() - 3 * 24 * 60 * 60 * 1000;
	return candidate >= cutoff ? year : year + 1;
}

function validIsoOrNull(year: number, month: number, day: number): string | null {
	if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
	if (month < 1 || month > 12 || day < 1 || day > 31) return null;
	if (year < 2000 || year > 2100) return null;

	// Afvis 31. februar o.l. ved at kontrollere at Date bevarer dagen.
	const dt = new Date(Date.UTC(year, month - 1, day));
	if (dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;

	return `${year}-${pad(month)}-${pad(day)}`;
}

/** True hvis ISO-datoen ligger i dag eller senere. */
export function isUpcoming(isoDate: string | null, referenceDate = new Date()): boolean {
	if (!isoDate) return false;
	const today = referenceDate.toISOString().slice(0, 10);
	return isoDate >= today;
}

/**
 * Find et datointerval i fri tekst: "14.–16. juni 2026", "3-5 juli".
 * Returnerer begge ender når det lykkes, ellers kun det den kan.
 */
export function parseDanishDateRange(
	raw: string | null | undefined,
	referenceDate = new Date()
): { start: string | null; end: string | null } {
	if (!raw) return { start: null, end: null };
	const text = String(raw).trim().toLowerCase();

	// "14.-16. juni 2026" — to dage, én måned.
	const sameMonth = text.match(
		/(\d{1,2})\.?\s*[–-]\s*(\d{1,2})\.?\s*(januar|jan|februar|feb|marts|mar|april|apr|maj|juni|jun|juli|jul|august|aug|september|sept|sep|oktober|okt|november|nov|december|dec)\.?(?:\s*(\d{4}))?/
	);
	if (sameMonth) {
		const month = MONTHS[sameMonth[3]];
		const year = sameMonth[4]
			? Number(sameMonth[4])
			: inferYear(month, Number(sameMonth[1]), referenceDate);
		return {
			start: validIsoOrNull(year, month, Number(sameMonth[1])),
			end: validIsoOrNull(year, month, Number(sameMonth[2]))
		};
	}

	// Ellers: første dato der kan tolkes, ingen slutdato.
	return { start: parseDanishDate(text, referenceDate), end: null };
}

function pad(n: number): string {
	return String(n).padStart(2, '0');
}
