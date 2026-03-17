import { requireUser } from '$lib/auth/requireUser';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load = (async (event) => {
	const { user } = await requireUser(event);
	const { supabase } = event.locals;

	const { data: bookings } = await supabase
		.from('user_bookings')
		.select('id, user_id, bookable_id, bookable_name, booking_date, timeslot, created_at')
		.gte('booking_date', '1970-01-01')
		.order('booking_date', { ascending: true })
		.order('timeslot', { ascending: true });

	return {
		userId: user.id,
		bookings: bookings ?? []
	};
}) satisfies PageServerLoad;

export const actions = {
	book: async (event) => {
		const { user } = await requireUser(event);
		const { supabase } = event.locals;
		const formData = await event.request.formData();

		const bookableId = String(formData.get('bookable_id') ?? '').trim();
		const bookableName = String(formData.get('bookable_name') ?? '').trim();
		const bookingDate = String(formData.get('booking_date') ?? '').trim();
		const timeslot = String(formData.get('timeslot') ?? '').trim();
		const seats = Math.max(1, Number(formData.get('seats') ?? 1));

		if (!bookableId || !bookableName || !bookingDate || !timeslot) {
			return fail(400, { message: 'Missing booking fields.' });
		}

		const { count } = await supabase
			.from('user_bookings')
			.select('*', { count: 'exact', head: true })
			.eq('bookable_id', bookableId)
			.eq('booking_date', bookingDate)
			.eq('timeslot', timeslot);

		if ((count ?? 0) >= seats) {
			return fail(409, { message: 'No seats left for this slot.' });
		}

		const { error } = await supabase.from('user_bookings').insert({
			user_id: user.id,
			bookable_id: bookableId,
			bookable_name: bookableName,
			booking_date: bookingDate,
			timeslot
		});

		if (error) {
			if (error.code === '23505') {
				return fail(409, { message: 'You already booked this slot.' });
			}
			return fail(500, { message: 'Could not save booking.' });
		}

		return { success: true, message: 'Booking confirmed.' };
	}
} satisfies Actions;
