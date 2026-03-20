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

export function clientRateLimitKey(event: {
	request: Request;
	getClientAddress: () => string;
}): string {
	const forwarded = event.request.headers.get('x-forwarded-for');
	if (forwarded) {
		return forwarded.split(',')[0]?.trim() || 'unknown';
	}
	try {
		return event.getClientAddress();
	} catch {
		return 'unknown';
	}
}
