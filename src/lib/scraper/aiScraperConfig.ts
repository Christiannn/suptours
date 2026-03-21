/**
 * Allowlisted models for scraper (search filter + event extraction).
 * Tier presets map to a concrete model ID per provider.
 */
export type AiProvider = 'gemini' | 'claude';

export type AiTier = 'fast' | 'pro';

export interface AiScraperConfig {
	provider: AiProvider;
	model: string;
}

/** Default when API receives no JSON body */
export const DEFAULT_AI_CONFIG: AiScraperConfig = {
	provider: 'gemini',
	model: 'gemini-3-flash-preview',
};

/**
 * Preset per provider × tier (shown in admin Agents + scraper requests).
 * "Fast" = billig/hurtig; "Pro" = dybere/kraftigere.
 */
export const MODEL_BY_PROVIDER_TIER: Record<AiProvider, Record<AiTier, string>> = {
	gemini: {
		fast: 'gemini-3-flash-preview',
		pro: 'gemini-2.5-pro',
	},
	claude: {
		fast: 'claude-3-5-haiku-20241022',
		pro: 'claude-sonnet-4-6',
	},
};

/** Optional extra models selectable manually in admin (older prefs / fallback) */
export const EXTRA_ALLOWED_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash'] as const;

const ALLOWED = new Set<string>([
	...Object.values(MODEL_BY_PROVIDER_TIER.gemini),
	...Object.values(MODEL_BY_PROVIDER_TIER.claude),
	...EXTRA_ALLOWED_MODELS,
]);

export function isAllowedModel(model: string): boolean {
	return ALLOWED.has(model);
}

export function inferProviderFromModel(model: string): AiProvider {
	if (model.startsWith('claude')) return 'claude';
	return 'gemini';
}
