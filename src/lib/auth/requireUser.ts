import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export const requireUser = async (event: RequestEvent) => {
	const { url, locals: { safeGetSession } } = event;
	const { user } = await safeGetSession();
	const path = `${url.pathname || '/'}${url.search || ''}`;

	if (!user) {
		throw redirect(303, '/login?next=' + encodeURIComponent(path));
	}

	return { user };
};