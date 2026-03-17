import { requireUser } from '$lib/auth/requireUser';
import type { PageServerLoad } from './$types';

export const load = (async (event) => {
	await requireUser(event);
	return {};
}) satisfies PageServerLoad;
