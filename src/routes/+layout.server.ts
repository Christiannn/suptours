import type { LayoutServerLoad } from "./$types";

export const load = (async ({ locals: { safeGetSession, supabase } }) => {

    const { user, session } = await safeGetSession();
    
    // Fetch profile data including is_admin
    const { data: profile } = user 
        ? await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single()
        : { data: null };

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
        isAdmin: profile?.is_admin ?? false,
        myBookings: myBookings ?? []
    };

}) satisfies LayoutServerLoad;