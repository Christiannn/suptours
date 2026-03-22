import type { AiScraperConfig } from './aiScraperConfig';
import {
	DEFAULT_AI_CONFIG,
	MODEL_BY_PROVIDER_TIER,
	isAllowedModel,
	inferProviderFromModel,
	type AiProvider,
	type AiTier,
} from './aiScraperConfig';

function isProvider(x: unknown): x is AiProvider {
	return x === 'gemini' || x === 'claude';
}

function isTier(x: unknown): x is AiTier {
	return x === 'fast' || x === 'pro';
}

/**
 * Parse POST JSON body from admin scraper UI.
 * Expected: { provider?, tier?, model? } — model overrides tier when allowlisted.
 */
export function resolveAiScraperConfig(body: unknown): AiScraperConfig {
	if (!body || typeof body !== 'object') return DEFAULT_AI_CONFIG;

	const b = body as Record<string, unknown>;

	if (typeof b.model === 'string' && b.model.trim()) {
		const model = b.model.trim();
		if (isAllowedModel(model)) {
			return {
				provider: isProvider(b.provider) ? b.provider : inferProviderFromModel(model),
				model,
			};
		}
	}

	const provider = isProvider(b.provider) ? b.provider : DEFAULT_AI_CONFIG.provider;
	const tier: AiTier = isTier(b.tier) ? b.tier : 'fast';

	return {
		provider,
		model: MODEL_BY_PROVIDER_TIER[provider][tier],
	};
}
