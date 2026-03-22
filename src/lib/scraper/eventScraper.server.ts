/**
 * eventScraper.server.ts
 *
 * Phase 2 – Event extraction.
 * Fetches each active source URL, strips HTML to plain text, then asks the
 * configured AI (Gemini or Claude) to extract structured SUP-event data.
 */

import type { AiScraperConfig } from './aiScraperConfig';
import { DEFAULT_AI_CONFIG } from './aiScraperConfig';
import { generateAiText } from './generateAiText.server';

export interface ExtractedEvent {
	title: string;
	description: string;
	start_date: string | null; // YYYY-MM-DD
	end_date: string | null; // YYYY-MM-DD
	start_time: string | null; // HH:MM
	locality: string | null;
	external_url: string;
	tags: string[];
	contact_info: string | null;
	max_participants: number | null;
	responsible_person: string | null;
}

export interface ScrapeEventOptions {
	instructions?: string;
}

/**
 * Fetch a URL, extract text, and ask the AI to find all upcoming SUP events.
 */
export async function scrapeEventsFromUrl(
	url: string,
	config: AiScraperConfig = DEFAULT_AI_CONFIG,
	options: ScrapeEventOptions = {},
): Promise<ExtractedEvent[]> {
	const html = await fetchPage(url);
	if (!html) return [];

	const text = htmlToText(html);
	if (text.length < 100) return [];

	return extractEventsWithAi(text, url, config, options.instructions);
}

async function fetchPage(url: string): Promise<string | null> {
	try {
		const res = await fetch(url, {
			headers: {
				'User-Agent':
					'Mozilla/5.0 (compatible; SUPToursBot/1.0; +https://suptours.dk)',
				Accept: 'text/html,application/xhtml+xml',
			},
			signal: AbortSignal.timeout(12_000),
		});
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	}
}

function htmlToText(html: string): string {
	return html
		.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
		.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/\s{2,}/g, ' ')
		.trim()
		.slice(0, 10_000);
}

async function extractEventsWithAi(
	pageText: string,
	sourceUrl: string,
	config: AiScraperConfig,
	instructions?: string,
): Promise<ExtractedEvent[]> {
	const currentYear = new Date().getFullYear();
	const customInstructions = instructions?.trim()
		? `\nEkstra instruktioner fra admin:\n${instructions.trim()}\n`
		: '';

	const prompt = `
Du er en assistent der udtrækker SUP-arrangementer (Stand Up Paddleboard) fra websider.

Kilde-URL: ${sourceUrl}

Sidens tekstindhold:
---
${pageText}
---

Opgave:
Udtræk ALLE kommende SUP-arrangementer, stævner, ture eller events der er nævnt på siden.
Medtag kun events fra ${currentYear} eller frem – skip historiske events.
Hvis du er i tvivl om datoen, inkluder arrangementet alligevel og sæt dato til null.
${customInstructions}

Returner et JSON-array – intet andet:
[
  {
    "title": "Arrangementets navn",
    "description": "Kort beskrivelse (maks 300 tegn)",
    "start_date": "YYYY-MM-DD eller null",
    "end_date": "YYYY-MM-DD eller null",
    "start_time": "HH:MM eller null",
    "locality": "By eller sted i Danmark, eller null",
    "external_url": "${sourceUrl}",
    "tags": ["sup"],
    "contact_info": "kontaktoplysninger eller null",
    "max_participants": null,
    "responsible_person": null
  }
]

Hvis der ikke er nogen SUP-arrangementer på siden, returner [].
`;

	const text = await generateAiText(prompt, config);

	try {
		const match = text.match(/\[[\s\S]*\]/);
		if (!match) return [];
		const events = JSON.parse(match[0]) as ExtractedEvent[];
		return events.map((e) => ({
			...e,
			tags: Array.from(new Set(['sup', ...(e.tags ?? [])])),
		}));
	} catch {
		console.error('Failed to parse AI event response:', text.slice(0, 500));
		return [];
	}
}
