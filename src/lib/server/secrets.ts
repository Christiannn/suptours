/**
 * Server-only: read private env from `.env`.
 * Use both `$env/dynamic/private` and `process.env` — in some Vite/SvelteKit dev setups
 * only one of them receives custom keys like `GEMINI_API_KEY`.
 */
import { env } from '$env/dynamic/private';

export function readEnv(key: string): string | undefined {
	const fromKit = (env as Record<string, string | undefined>)[key];
	const fromNode = process.env[key];
	const raw = fromKit ?? fromNode;
	const k = typeof raw === 'string' ? raw.trim() : '';
	return k || undefined;
}

export function getGeminiApiKey(): string | undefined {
	return readEnv('GEMINI_API_KEY');
}

export function getAnthropicApiKey(): string | undefined {
	return readEnv('ANTHROPIC_API_KEY');
}

/** Optional default Gemini model id from env */
export function getGeminiModelEnv(): string | undefined {
	return readEnv('GEMINI_MODEL');
}

/**
 * Base URL the SERVER should use to reach Supabase, when it differs from the
 * public one. Unset falls back to PUBLIC_SUPABASE_URL.
 *
 * In production this points at the gateway on loopback, so server-side calls
 * don't leave the box, resolve DNS and complete a TLS handshake just to reach
 * a container running alongside them.
 */
export function getSupabaseInternalUrl(): string | undefined {
	return readEnv('SUPABASE_INTERNAL_URL');
}

/** Brave Search API — required for scraper phase 1 (find URLs). */
export function getBraveSearchApiKey(): string | undefined {
	return readEnv('BRAVE_SEARCH_API_KEY');
}
