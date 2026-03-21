/**
 * Browser-only persistence for admin scraper AI choice (provider / tier / optional model).
 * Not sent to the database — only localStorage + request body to API routes.
 */
import {
	DEFAULT_AI_CONFIG,
	MODEL_BY_PROVIDER_TIER,
	isAllowedModel,
	type AiProvider,
	type AiTier,
} from '$lib/scraper/aiScraperConfig';

const STORAGE_KEY = 'suptours:adminAiScraperPrefs';

export type StoredAiPrefs = {
	provider: AiProvider;
	tier: AiTier;
	/** If set and allowlisted, sent as `model` and overrides tier mapping */
	model?: string;
};

export function defaultStoredAiPrefs(): StoredAiPrefs {
	return {
		provider: DEFAULT_AI_CONFIG.provider,
		tier: 'fast',
	};
}

export function loadStoredAiPrefs(): StoredAiPrefs {
	if (typeof window === 'undefined') return defaultStoredAiPrefs();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return defaultStoredAiPrefs();
		const p = JSON.parse(raw) as Partial<StoredAiPrefs>;
		const provider: AiProvider = p.provider === 'claude' ? 'claude' : 'gemini';
		const tier: AiTier = p.tier === 'pro' ? 'pro' : 'fast';
		let model: string | undefined;
		if (typeof p.model === 'string' && p.model.trim() && isAllowedModel(p.model.trim())) {
			model = p.model.trim();
		}
		return { provider, tier, model };
	} catch {
		return defaultStoredAiPrefs();
	}
}

export function saveStoredAiPrefs(p: StoredAiPrefs): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

/** Body for POST /api/scraper/search and /api/scraper/scrape */
export function prefsToApiBody(p: StoredAiPrefs): { provider: AiProvider; tier: AiTier; model?: string } {
	const body: { provider: AiProvider; tier: AiTier; model?: string } = {
		provider: p.provider,
		tier: p.tier,
	};
	if (p.model) body.model = p.model;
	return body;
}

export function resolvedModelLabel(p: StoredAiPrefs): string {
	const explicit = p.model?.trim();
	if (explicit) return explicit;
	return MODEL_BY_PROVIDER_TIER[p.provider][p.tier];
}
