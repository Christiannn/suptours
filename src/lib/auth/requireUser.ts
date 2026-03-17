import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export const requireUser = async (event: RequestEvent) => {
	const { url, locals: { safeGetSession } } = event;
	const { user } = await safeGetSession();
	const path = url.pathname || '/';

	if (!user) {
		redirect(303, '/login?next=' + path);
	}

	return { user };
};