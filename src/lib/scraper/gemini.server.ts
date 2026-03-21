/**
 * Shared Gemini client for scraper phases (search filter + event extraction).
 * Uses `GEMINI_API_KEY` from `.env` (via SvelteKit). `modelId` from admin selection or `GEMINI_MODEL`.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiApiKey, getGeminiModelEnv } from '$lib/server/secrets';

const FALLBACK_MODEL = 'gemini-3-flash-preview';

export async function generateGeminiText(prompt: string, modelId?: string): Promise<string> {
	const apiKey = getGeminiApiKey();
	if (!apiKey) {
		throw new Error('GEMINI_API_KEY is not configured');
	}
	const resolved =
		modelId?.trim() || getGeminiModelEnv() || FALLBACK_MODEL;
	const genAI = new GoogleGenerativeAI(apiKey);
	const model = genAI.getGenerativeModel({ model: resolved });
	const result = await model.generateContent(prompt);
	return result.response.text();
}
