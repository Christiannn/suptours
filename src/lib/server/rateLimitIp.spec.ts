import { describe, expect, it } from 'vitest';
import { allowWithinWindow, clientRateLimitKey } from './rateLimitIp';

describe('clientRateLimitKey', () => {
	it('ignores a client-supplied x-forwarded-for header', () => {
		// Regression guard. A reverse proxy appends the real client IP to
		// whatever the client already sent, so the leftmost entry is
		// attacker-controlled. Reading it made the limiter bypassable: a fresh
		// forged value per request minted a fresh bucket every time.
		//
		// The extra `request` is deliberate — if header parsing is ever
		// reintroduced, this returns '9.9.9.9' and the test fails.
		const event = {
			getClientAddress: () => '203.0.113.7',
			request: new Request('https://suptur.dk/api/x-bot-agent-intent', {
				headers: { 'x-forwarded-for': '9.9.9.9, 203.0.113.7' }
			})
		} as Parameters<typeof clientRateLimitKey>[0];

		expect(clientRateLimitKey(event)).toBe('203.0.113.7');
	});

	it('falls back to a constant key when the address cannot be resolved', () => {
		// adapter-node throws when ADDRESS_HEADER is set but absent, which
		// happens on direct loopback requests that bypass the proxy.
		const event = {
			getClientAddress: () => {
				throw new Error('Address header was not set');
			}
		};

		expect(clientRateLimitKey(event)).toBe('unknown');
	});

	it('buckets forged headers together instead of granting each a fresh window', () => {
		// The behaviour the bug actually cost us: same real client, varying
		// forged header, must still hit the limit.
		const limit = 3;
		const results = Array.from({ length: 5 }, (_, i) =>
			allowWithinWindow(
				clientRateLimitKey({
					getClientAddress: () => '198.51.100.4',
					request: new Request('https://suptur.dk/', {
						headers: { 'x-forwarded-for': `9.9.9.${i}, 198.51.100.4` }
					})
				} as Parameters<typeof clientRateLimitKey>[0]),
				limit,
				60_000
			)
		);

		expect(results).toEqual([true, true, true, false, false]);
	});
});
