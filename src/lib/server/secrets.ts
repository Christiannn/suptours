/**
 * Server-only: read private env from `.env`.
 * Use both `$env/dynamic/private` and `process.env` — in some Vite/SvelteKit dev setups
 * only one of them receives custom keys like `GEMINI_API_KEY`.
 */
import { env } from '$env/dynamic/private';

function readEnv(key: string): string | undefined {
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

/** Brave Search API — required for scraper phase 1 (find URLs). */
export function getBraveSearchApiKey(): string | undefined {
	return readEnv('BRAVE_SEARCH_API_KEY');
}
