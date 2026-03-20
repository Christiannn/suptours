/** Last calendar day of the trip: multi-day uses end_date when it is after start_date. */
export function effectiveTripEndDate(startDate: string, endDate: string | null): string {
	if (endDate != null && endDate > startDate) return endDate;
	return startDate;
}

/** YYYY-MM-DD trip is fully in the past (strictly before today in local server date). */
export function isTripReadyForReview(tripEndYmd: string, todayYmd: string): boolean {
	return tripEndYmd < todayYmd;
}

export function reviewAverageRounded(
	nature: number,
	access: number,
	hosts: number
): number {
	return Math.round((nature + access + hosts) / 3);
}

export type PendingTourRecap = {
	id: string;
	title: string;
	start_date: string;
	end_date: string | null;
	start_time: string | null;
	locality: string | null;
	image_url: string | null;
	trip_end_date: string;
};
