import type { Tour } from '$lib/tours/dateGrouping';

/**
 * Case-insensitive search across title, description, locality, tags, organizer.
 * All whitespace-separated tokens must match somewhere (AND). Returns up to `limit` tours,
 * ranked by title matches first, then by start date.
 */
export function searchTours(tours: Tour[], query: string, limit = 10): Tour[] {
	const raw = query.trim();
	if (!raw) return tours;

	const tokens = raw
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean);
	if (tokens.length === 0) return tours;

	const scored: { tour: Tour; score: number }[] = [];

	for (const tour of tours) {
		const title = (tour.title ?? '').toLowerCase();
		const desc = (tour.description ?? '').toLowerCase();
		const loc = (tour.locality ?? '').toLowerCase();
		const resp = (tour.responsible_person ?? '').toLowerCase();
		const tags = (tour.tags ?? []).join(' ').toLowerCase();
		const hay = `${title} ${desc} ${loc} ${resp} ${tags}`;

		const allMatch = tokens.every((tok) => hay.includes(tok));
		if (!allMatch) continue;

		let score = 0;
		for (const tok of tokens) {
			if (title.includes(tok)) score += 4;
			else if (tags.includes(tok)) score += 2;
			else if (loc.includes(tok)) score += 2;
			else if (desc.includes(tok)) score += 1;
		}

		scored.push({ tour, score });
	}

	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		return a.tour.start_date.localeCompare(b.tour.start_date);
	});

	return scored.map((s) => s.tour).slice(0, limit);
}
