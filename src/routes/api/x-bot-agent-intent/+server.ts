/**
 * GET /api/x-bot-agent-intent?q=...&... — log URL query from agents (max 2 req/s per IP).
 * Stores search params in agent_intent_log for product / intent research.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { allowWithinWindow, clientRateLimitKey } from '$lib/server/rateLimitIp';

const MAX_SUMMARY = 8000;
const MAX_RAW = 16000;
const REQUESTS_PER_SEC = 2;
const WINDOW_MS = 1000;

function clip(s: string | null, max: number): string | null {
	if (s == null) return null;
	const t = s.trim();
	if (!t) return null;
	return t.length > max ? t.slice(0, max) : t;
}

function firstNonEmpty(sp: URLSearchParams, keys: string[]): string {
	for (const k of keys) {
		const v = sp.get(k);
		if (v != null && v.trim()) return v.trim();
	}
	return '';
}

/** Best-effort “what they’re looking for” from typical query keys. */
function summarizeIntent(sp: URLSearchParams): string {
	const primary = firstNonEmpty(sp, [
		'q',
		'query',
		'search',
		'purpose',
		'users_looking_for',
		'intent',
		'notes',
	]);
	if (primary) return primary.slice(0, MAX_SUMMARY);

	const pairs = [...sp.entries()]
		.map(([k, v]) => `${k}=${v}`)
		.join(' & ');
	return pairs.slice(0, MAX_SUMMARY);
}

const cors = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, { headers: cors });
};

export const GET: RequestHandler = async (event) => {
	const { request, locals: { supabase }, url } = event;
	const ipKey = clientRateLimitKey(event);

	if (!allowWithinWindow(ipKey, REQUESTS_PER_SEC, WINDOW_MS)) {
		return json(
			{ error: 'Too many requests', retryAfterMs: WINDOW_MS },
			{
				status: 429,
				headers: {
					...cors,
					'Retry-After': '1',
				},
			},
		);
	}

	const sp = url.searchParams;
	if (sp.size === 0) {
		throw error(
			400,
			'Add at least one query parameter, e.g. ?q=what+users+want&notes=beginner+tours',
		);
	}

	const query_params: Record<string, string> = {};
	for (const [k, v] of sp.entries()) {
		query_params[k] = v;
	}

	const intent_summary = summarizeIntent(sp);
	const raw_q = url.search.startsWith('?') ? url.search.slice(1) : url.search;

	const row = {
		query_params,
		intent_summary: intent_summary || null,
		raw_query: clip(raw_q, MAX_RAW),
		referrer: clip(request.headers.get('referer'), 2000),
		user_agent: clip(request.headers.get('user-agent'), 2000),
	};

	const { data, error: insErr } = await supabase
		.from('agent_intent_log')
		.insert(row)
		.select('id')
		.single();

	if (insErr) {
		console.error('[api/x-bot-agent-intent]', insErr);
		throw error(500, 'Could not store intent log');
	}

	return json(
		{
			ok: true,
			id: data?.id,
			logged: {
				intent_summary: row.intent_summary,
				query_params: row.query_params,
			},
		},
		{ headers: cors },
	);
};
