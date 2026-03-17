import type { LayoutServerLoad } from "./$types";

export const load = (async ({ locals: { safeGetSession, supabase } }) => {

    const { user, session } = await safeGetSession();
    const { data: myBookings } = user
        ? await supabase
            .from('user_bookings')
            .select('id, bookable_name, booking_date, timeslot')
            .eq('user_id', user.id)
            .order('booking_date', { ascending: true })
            .order('timeslot', { ascending: true })
            .limit(6)
        : { data: [] };

    return {
        user,
        session,
        myBookings: myBookings ?? []
    };

}) satisfies LayoutServerLoad;