import {
    PUBLIC_SUPABASE_ANON_KEY,
    PUBLIC_SUPABASE_URL,
} from "$env/static/public";
import { createServerClient } from "@supabase/ssr";
import { error, redirect, type Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {

    event.locals.supabase = createServerClient(
        PUBLIC_SUPABASE_URL,
        PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll: () => event.cookies.getAll(),
                setAll: (cookiesToSet) => {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        event.cookies.set(name, value, {
                            ...options,
                            path: "/"
                        });
                    });
                }
            }
        }
    ) as App.Locals['supabase'];

    event.locals.safeGetSession = async () => {

        /** @ts-expect-error: suppressGetSessionWarning is not officially supported */
        event.locals.supabase.auth.suppressGetSessionWarning = true;

        const {
            data: { session },
        } = await event.locals.supabase.auth.getSession();
        if (!session) {
            return { session: null, user: null };
        }

        const {
            data: { user },
            error,
        } = await event.locals.supabase.auth.getUser();
        if (error) {
            return { session: null, user: null };
        }

        return {
            session,
            user
        };
    };

    // ADMIN PROTECTION
    if (event.url.pathname.startsWith('/admin')) {
        const { user } = await event.locals.safeGetSession();
        if (!user) {
            throw redirect(303, '/login?next=' + event.url.pathname);
        }

        const { data: profile } = await event.locals.supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single();

        if (!profile?.is_admin) {
            throw error(403, 'Forbidden: Admin access required');
        }
    }

    return resolve(event, {
        filterSerializedResponseHeaders(name) {
            return name === "content-range" ||
                name === "x-supabase-api-version";
        }
    });
};