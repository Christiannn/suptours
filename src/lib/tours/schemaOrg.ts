/**
 * schema.org JSON-LD builders for tours (agents, crawlers, rich results).
 */
import { getTourShowSlug } from '$lib/tours/tourSlug';
import type { Tour } from '$lib/tours/dateGrouping';

const CTX = 'https://schema.org';

/** Safe for embedding in `<script type="application/ld+json">` (avoids `</script>` breaks). */
export function safeJsonLdStringify(obj: unknown) {
	return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function abs(origin: string, path: string) {
	const base = origin.replace(/\/$/, '');
	const p = path.startsWith('/') ? path : `/${path}`;
	return `${base}${p}`;
}

function isoStartDate(tour: {
	start_date: string;
	start_time: string | null;
	end_date: string | null;
}) {
	const t = tour.start_time
		? tour.start_time.length <= 5
			? `${tour.start_time}:00`
			: tour.start_time
		: '10:00:00';
	const start = `${tour.start_date}T${t}`;
	if (tour.end_date && tour.end_date !== tour.start_date) {
		const endT = tour.start_time
			? tour.start_time.length <= 5
				? `${tour.start_time}:00`
				: tour.start_time
			: '18:00:00';
		return { startDate: start, endDate: `${tour.end_date}T${endT}` };
	}
	return { startDate: start, endDate: undefined as string | undefined };
}

/** Single tour as SportsEvent (detail page or list items). */
export function buildTourSportsEvent(origin: string, tour: Tour) {
	const { startDate, endDate } = isoStartDate(tour);
	const detailUrl = abs(origin, `/tours/${tour.id}`);
	const agendaShowUrl = abs(origin, `/tours?show=${encodeURIComponent(getTourShowSlug(tour))}`);

	const loc =
		tour.latitude != null && tour.longitude != null
			? {
					'@type': 'Place',
					name: tour.locality ?? 'SUP tour location',
					geo: {
						'@type': 'GeoCoordinates',
						latitude: tour.latitude,
						longitude: tour.longitude,
					},
				}
			: tour.locality
				? {
						'@type': 'Place',
						name: tour.locality,
					}
				: undefined;

	const ev: Record<string, unknown> = {
		'@type': 'SportsEvent',
		'@id': `${detailUrl}#event`,
		name: tour.title,
		description: tour.description ?? undefined,
		image: tour.image_url ?? undefined,
		startDate,
		eventStatus: `${CTX}/EventScheduled`,
		eventAttendanceMode: `${CTX}/OfflineEventAttendanceMode`,
		url: detailUrl,
		sameAs: [agendaShowUrl],
	};

	if (endDate) ev.endDate = endDate;
	if (loc) ev.location = loc;
	if (tour.max_participants != null) {
		ev.maximumAttendeeCapacity = tour.max_participants;
	}
	if (tour.responsible_person) {
		const org: Record<string, unknown> = {
			'@type': 'Organization',
			name: tour.responsible_person,
		};
		if (tour.contact_info && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tour.contact_info.trim())) {
			org.email = tour.contact_info.trim();
		}
		ev.organizer = org;
	}

	return ev;
}

/** ItemList of the first N upcoming tours (matches default visible slice on /tours). */
function buildAgendaItemListPayload(origin: string, tours: Tour[], limit: number) {
	const slice = tours.slice(0, limit);
	const elements = slice.map((tour, i) => ({
		'@type': 'ListItem',
		position: i + 1,
		item: buildTourSportsEvent(origin, tour),
	}));

	return {
		'@type': 'ItemList',
		name: 'Next upcoming SUP tours',
		description:
			'Published tours from the SUP Tours agenda (same ordering as the public list).',
		numberOfItems: elements.length,
		itemListElement: elements,
	};
}

/** Full graph for /tours page (ItemList of five; site-wide graph lives in app.html). */
export function buildToursPageJsonLd(origin: string, tours: Tour[]) {
	return {
		'@context': CTX,
		'@graph': [buildAgendaItemListPayload(origin, tours, 5)],
	};
}

/**
 * Same as {@link buildToursPageJsonLd}, but if `spotlight` is set and not among the first five,
 * adds its SportsEvent so agents still see full schema when `?show=` opens a tour further down the list.
 */
export function buildToursPageJsonLdWithSpotlight(
	origin: string,
	tours: TourSchemaInput[],
	spotlight: TourSchemaInput | null,
) {
	const graph: object[] = [buildAgendaItemListPayload(origin, tours, 5)];
	const firstFiveIds = new Set(tours.slice(0, 5).map((t) => t.id));
	if (spotlight && !firstFiveIds.has(spotlight.id)) {
		graph.push(buildTourSportsEvent(origin, spotlight));
	}
	return {
		'@context': CTX,
		'@graph': graph,
	};
}

/** Single tour detail page graph. */
export function buildTourDetailPageJsonLd(origin: string, tour: Tour) {
	return {
		'@context': CTX,
		'@graph': [
			buildTourSportsEvent(origin, tour),
			{
				'@type': 'WebPage',
				'@id': `${abs(origin, `/tours/${tour.id}`)}#webpage`,
				name: tour.title,
				description: tour.description ?? tour.title,
				url: abs(origin, `/tours/${tour.id}`),
				mainEntity: { '@id': `${abs(origin, `/tours/${tour.id}`)}#event` },
			},
		],
	};
}
