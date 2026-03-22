import { fail } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { requireUser } from '$lib/auth/requireUser';
import { loadPendingTourReviews } from '$lib/server/pendingTourReviews';
import {
	effectiveTripEndDate,
	isTripReadyForReview,
	reviewAverageRounded
} from '$lib/tours/reviewHelpers';
import type { Actions, PageServerLoad } from './$types';

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

function localTodayYmd(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

async function assertEligibleForReview(
	supabase: App.Locals['supabase'],
	userId: string,
	tourId: string
): Promise<{ ok: true; tour: TourJoinRow } | { ok: false; status: number; message: string }> {
	const today = localTodayYmd();

	const { data: part } = await supabase
		.from('tour_participants')
		.select('id')
		.eq('tour_id', tourId)
		.eq('user_id', userId)
		.maybeSingle();

	if (!part) {
		return { ok: false, status: 403, message: 'You are not signed up for this tour.' };
	}

	const { data: tour, error } = await supabase
		.from('tours')
		.select(
			'id, title, start_date, end_date, start_time, locality, image_url, creator_id, status'
		)
		.eq('id', tourId)
		.maybeSingle();

	if (error || !tour) {
		return { ok: false, status: 400, message: 'Tour not found.' };
	}

	if (tour.status !== 'published') {
		return { ok: false, status: 400, message: 'This tour is not published.' };
	}

	if (tour.creator_id === userId) {
		return { ok: false, status: 400, message: 'Organizers do not review their own tours.' };
	}

	const tripEnd = effectiveTripEndDate(tour.start_date, tour.end_date);
	if (!isTripReadyForReview(tripEnd, today)) {
		return { ok: false, status: 400, message: 'This trip has not finished yet.' };
	}

	const { data: existing } = await supabase
		.from('tour_reviews')
		.select('id')
		.eq('tour_id', tourId)
		.eq('user_id', userId)
		.maybeSingle();

	if (existing) {
		return { ok: false, status: 400, message: 'You already responded for this tour.' };
	}

	return { ok: true, tour };
}

function visibilityLabel(v: number): string {
	if (v === 0) return 'Visible to host only';
	if (v === 1) return 'Host & participants';
	return 'Public on site';
}

export const load = (async (event) => {
	const { user } = await requireUser(event);
	const { supabase } = event.locals;

	const pendingTourReviews = await loadPendingTourReviews(supabase, user.id);

	const { data: rawRows } = await supabase
		.from('tour_reviews')
		.select(
			`
			id,
			tour_id,
			created_at,
			declined,
			rating_nature,
			rating_access,
			rating_hosts,
			comment,
			visibility,
			image_url,
			tours ( id, title )
		`
		)
		.eq('user_id', user.id)
		.order('created_at', { ascending: false });

	type TourMini = { id: string; title: string };
	type RawReview = {
		id: string;
		tour_id: string;
		created_at: string | null;
		declined: boolean;
		rating_nature: number | null;
		rating_access: number | null;
		rating_hosts: number | null;
		comment: string | null;
		visibility: number;
		image_url: string | null;
		tours: TourMini | TourMini[] | null;
	};

	const myReviews = (rawRows ?? []).map((row: RawReview) => {
		const tr = row.tours;
		const tour = Array.isArray(tr) ? tr[0] : tr;
		const title = tour?.title ?? 'Tour';
		const tourId = tour?.id ?? row.tour_id;

		if (row.declined) {
			return {
				id: row.id,
				kind: 'declined' as const,
				tourId,
				title,
				created_at: row.created_at
			};
		}

		const n = row.rating_nature;
		const a = row.rating_access;
		const h = row.rating_hosts;
		const hasRatings = n != null && a != null && h != null;

		return {
			id: row.id,
			kind: 'submitted' as const,
			tourId,
			title,
			created_at: row.created_at,
			rating_display: hasRatings ? reviewAverageRounded(n!, a!, h!) : 0,
			comment: row.comment,
			visibility: row.visibility,
			visibility_label: visibilityLabel(row.visibility),
			image_url: row.image_url,
			hasRatings
		};
	});

	return {
		user,
		pendingTourReviews,
		myReviews
	};
}) satisfies PageServerLoad;

function parseStar(name: FormDataEntryValue | null): number | null {
	const n = Number.parseInt(String(name ?? ''), 10);
	if (!Number.isInteger(n) || n < 1 || n > 5) return null;
	return n;
}

function parseVisibility(raw: FormDataEntryValue | null): number | null {
	const n = Number.parseInt(String(raw ?? ''), 10);
	if (!Number.isInteger(n) || n < 0 || n > 2) return null;
	return n;
}

function isAllowedReviewImageUrl(url: string | null | undefined, userId: string): boolean {
	const s = String(url ?? '').trim();
	if (s.length === 0) return true;
	if (s.length > 2048) return false;
	if (!PUBLIC_SUPABASE_URL) return false;
	try {
		const u = new URL(s);
		const allowedOrigin = new URL(PUBLIC_SUPABASE_URL).origin;
		const marker = `/storage/v1/object/public/tour-review-images/${userId}/`;
		return u.origin === allowedOrigin && u.pathname.startsWith(marker);
	} catch {
		return false;
	}
}

export const actions = {
	submitTourReview: async (event) => {
		const { user } = await requireUser(event);
		const { supabase } = event.locals;
		const fd = await event.request.formData();
		const tourId = String(fd.get('tour_id') ?? '').trim();

		if (!tourId) {
			return fail(400, { reviewError: 'Missing tour.' });
		}

		const gate = await assertEligibleForReview(supabase, user.id, tourId);
		if (!gate.ok) {
			return fail(gate.status, { reviewError: gate.message });
		}

		const rating_nature = parseStar(fd.get('rating_nature'));
		const rating_access = parseStar(fd.get('rating_access'));
		const rating_hosts = parseStar(fd.get('rating_hosts'));

		if (rating_nature === null || rating_access === null || rating_hosts === null) {
			return fail(400, { reviewError: 'Please rate all three areas (1–5 stars each).' });
		}

		const commentRaw = String(fd.get('comment') ?? '').trim();
		const comment = commentRaw.length > 0 ? commentRaw.slice(0, 2000) : null;

		const visibility = parseVisibility(fd.get('visibility'));
		if (visibility === null) {
			return fail(400, { reviewError: 'Choose who can see your review.' });
		}

		const imageUrlRaw = String(fd.get('image_url') ?? '').trim();
		const image_url = imageUrlRaw.length > 0 ? imageUrlRaw : null;
		if (!isAllowedReviewImageUrl(image_url, user.id)) {
			return fail(400, { reviewError: 'Invalid or unauthorized image URL.' });
		}

		const { error } = await supabase.from('tour_reviews').insert({
			tour_id: tourId,
			user_id: user.id,
			rating_nature,
			rating_access,
			rating_hosts,
			comment,
			visibility,
			image_url,
			declined: false,
			approved: true
		});

		if (error) {
			return fail(500, { reviewError: error.message });
		}

		return { reviewSuccess: true };
	},

	declineTourReview: async (event) => {
		const { user } = await requireUser(event);
		const { supabase } = event.locals;
		const fd = await event.request.formData();
		const tourId = String(fd.get('tour_id') ?? '').trim();

		if (!tourId) {
			return fail(400, { reviewError: 'Missing tour.' });
		}

		const gate = await assertEligibleForReview(supabase, user.id, tourId);
		if (!gate.ok) {
			return fail(gate.status, { reviewError: gate.message });
		}

		const { error } = await supabase.from('tour_reviews').insert({
			tour_id: tourId,
			user_id: user.id,
			declined: true,
			approved: false,
			rating_nature: null,
			rating_access: null,
			rating_hosts: null,
			comment: null
		});

		if (error) {
			return fail(500, { reviewError: error.message });
		}

		return { reviewDeclined: true };
	}
} satisfies Actions;
