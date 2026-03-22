import { getAnthropicApiKey, getGeminiApiKey } from '$lib/server/secrets';
import type { PageServerLoad } from './$types';

export const load = (() => {
	return {
		hasGeminiKey: !!getGeminiApiKey(),
		hasAnthropicKey: !!getAnthropicApiKey(),
	};
}) satisfies PageServerLoad;
