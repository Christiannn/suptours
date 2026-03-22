import type { AiScraperConfig } from './aiScraperConfig';
import { generateGeminiText } from './gemini.server';
import { generateClaudeText } from './claude.server';

export async function generateAiText(prompt: string, config: AiScraperConfig): Promise<string> {
	if (config.provider === 'claude') {
		return generateClaudeText(prompt, config.model);
	}
	return generateGeminiText(prompt, config.model);
}
