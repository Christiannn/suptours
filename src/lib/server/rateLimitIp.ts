/** In-memory sliding window: max `maxPerWindow` requests per `windowMs` per key (e.g. client IP). */

const buckets = new Map<string, number[]>();

export function allowWithinWindow(
	key: string,
	maxPerWindow: number,
	windowMs: number,
): boolean {
	const now = Date.now();
	const cutoff = now - windowMs;
	let stamps = buckets.get(key) ?? [];
	stamps = stamps.filter((t) => t > cutoff);
	if (stamps.length >= maxPerWindow) {
		buckets.set(key, stamps);
		return false;
	}
	stamps.push(now);
	buckets.set(key, stamps);
	return true;
}

export function clientRateLimitKey(event: { getClientAddress: () => string }): string {
	// Deliberately does NOT read x-forwarded-for directly. A reverse proxy
	// appends the real client IP to whatever the client already sent, so the
	// leftmost entry is attacker-controlled — reading it let anyone bypass this
	// limiter entirely by varying one forged header per request.
	//
	// adapter-node is configured with ADDRESS_HEADER=x-forwarded-for and
	// XFF_DEPTH=1 (deploy/scripts/provision.sh), so getClientAddress() already
	// returns the rightmost, proxy-appended value, which a client cannot forge.
	try {
		return event.getClientAddress();
	} catch {
		// adapter-node throws when ADDRESS_HEADER is set but the header is
		// absent — which happens on direct loopback requests that bypass Caddy.
		return 'unknown';
	}
}
