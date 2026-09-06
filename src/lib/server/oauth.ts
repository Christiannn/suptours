/**
 * Server-only: social login configuration and the shared form actions behind
 * the "Continue with …" buttons on /login and /signup.
 */
import { redirect, type RequestEvent } from '@sveltejs/kit';
import { readEnv } from './secrets';

export const OAUTH_PROVIDERS = ['google', 'facebook'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/**
 * Providers switched on via the comma-separated `ENABLE_OAUTH` env var
 * (e.g. `google,facebook`). Read at runtime, so turning a provider on is a
 * restart rather than a rebuild.
 *
 * Each provider named here must also be configured in the Supabase project —
 * listing one that isn't just moves the failure to the callback.
 */
export function getEnabledOAuthProviders(): OAuthProvider[] {
	const requested = new Set(
		(readEnv('ENABLE_OAUTH') ?? '')
			.split(',')
			.map((value) => value.trim().toLowerCase())
			.filter(Boolean)
	);

	return OAUTH_PROVIDERS.filter((provider) => requested.has(provider));
}

/** Shape handed to the page so it only renders buttons that actually work. */
export function getOAuthAvailability(): Record<OAuthProvider, boolean> {
	const enabled = getEnabledOAuthProviders();
	return {
		google: enabled.includes('google'),
		facebook: enabled.includes('facebook')
	};
}

/**
 * Builds the form action for one provider. Shared by /login and /signup, which
 * otherwise carried identical copies.
 *
 * Guards on the enabled list as well: without it, a hand-crafted POST to
 * `?/google` on an unconfigured install produces an opaque Supabase error.
 */
export function createOAuthAction(provider: OAuthProvider) {
	return async ({ locals: { supabase }, url }: RequestEvent) => {
		if (!getEnabledOAuthProviders().includes(provider)) {
			return { message: `${provider} login is not enabled.` };
		}

		const { data, error } = await supabase.auth.signInWithOAuth({
			provider,
			options: { redirectTo: `${url.origin}/auth/callback` }
		});

		if (error) {
			return { message: error.message };
		}

		if (data.url) {
			redirect(303, data.url);
		}
	};
}
