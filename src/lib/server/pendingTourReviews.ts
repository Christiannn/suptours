import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/database.types';
import {
	effectiveTripEndDate,
	isTripReadyForReview,
	type PendingTourRecap
} from '$lib/tours/reviewHelpers';

type TourJoinRow = {
	id: string;
	title: string;
	start_date: string;
	end_date: string | null;
	start_time: string | null;
	locality: string | null;
	image_url: string | null;
	creator_id: string;
	status: string;
};

/** Tours the user joined that have ended and still need a review or decline. */
export async function loadPendingTourReviews(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<PendingTourRecap[]> {
	const today = new Date().toISOString().split('T')[0];

	const { data: parts } = await supabase
		.from('tour_participants')
		.select(
			`
			tour_id,
			tours!inner (
				id,
				title,
				start_date,
				end_date,
				start_time,
				locality,
				image_url,
				creator_id,
				status
			)
		`
		)
		.eq('user_id', userId);

	const { data: myReviews } = await supabase
		.from('tour_reviews')
		.select('tour_id')
		.eq('user_id', userId);

	const respondedTourIds = new Set((myReviews ?? []).map((r) => r.tour_id));

	const pendingTourReviews: PendingTourRecap[] = [];

	for (const row of parts ?? []) {
		const toursUnknown = row.tours as TourJoinRow | TourJoinRow[] | null;
		const t = Array.isArray(toursUnknown) ? toursUnknown[0] : toursUnknown;
		if (!t || t.status !== 'published') continue;
		if (t.creator_id === userId) continue;
		if (respondedTourIds.has(t.id)) continue;

		const tripEnd = effectiveTripEndDate(t.start_date, t.end_date);
		if (!isTripReadyForReview(tripEnd, today)) continue;

		pendingTourReviews.push({
			id: t.id,
			title: t.title,
			start_date: t.start_date,
			end_date: t.end_date,
			start_time: t.start_time,
			locality: t.locality,
			image_url: t.image_url,
			trip_end_date: tripEnd
		});
	}

	pendingTourReviews.sort((a, b) => a.trip_end_date.localeCompare(b.trip_end_date));
	return pendingTourReviews;
}
