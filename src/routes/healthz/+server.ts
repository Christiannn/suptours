import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Give up on the dependency check well before any sane proxy or watchdog timeout. */
const DB_TIMEOUT_MS = 3000;

const startedAt = Date.now();

/**
 * Ask PostgREST for its schema. It builds that by querying the database, so a
 * 2xx here proves Kong, PostgREST and Postgres are all answering — without
 * depending on any particular table existing or being readable under RLS.
 */
async function checkDatabase(): Promise<{ ok: true } | { ok: false; error: string }> {
	const signal = AbortSignal.timeout(DB_TIMEOUT_MS);

	try {
		const res = await fetch(`${PUBLIC_SUPABASE_URL}/rest/v1/`, {
			method: 'HEAD',
			headers: { apikey: PUBLIC_SUPABASE_ANON_KEY },
			signal
		});

		return res.ok ? { ok: true } : { ok: false, error: `http ${res.status}` };
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		return { ok: false, error: reason };
	}
}

/**
 * Health probe for the deploy script's post-restart gate and for the watchdog.
 *
 * The status code carries the meaning, so callers can react correctly:
 *   200 — app and database both healthy.
 *   503 — app is serving but the database is not reachable. Restarting the app
 *         will not fix this, so the watchdog alerts instead of bouncing it.
 *   connection refused / timeout — the app itself is down; that one is worth a restart.
 */
export const GET: RequestHandler = async () => {
	const db = await checkDatabase();

	const body = {
		ok: db.ok,
		uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
		db: db.ok ? 'up' : 'down',
		...(db.ok ? {} : { error: db.error })
	};

	return json(body, {
		status: db.ok ? 200 : 503,
		headers: { 'cache-control': 'no-store' }
	});
};
