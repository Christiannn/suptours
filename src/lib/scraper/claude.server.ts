/**
 * Claude (Anthropic) for scraper phases when provider is "claude".
 * Uses ANTHROPIC_API_KEY.
 */
import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicApiKey } from '$lib/server/secrets';

export async function generateClaudeText(prompt: string, model: string): Promise<string> {
	const apiKey = getAnthropicApiKey();
	if (!apiKey) {
		throw new Error('ANTHROPIC_API_KEY is not configured');
	}
	const anthropic = new Anthropic({ apiKey });
	const response = await anthropic.messages.create({
		model,
		max_tokens: 4096,
		messages: [{ role: 'user', content: prompt }],
	});
	const block = response.content[0];
	return block.type === 'text' ? block.text : '';
}
