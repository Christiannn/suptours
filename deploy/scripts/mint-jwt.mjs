#!/usr/bin/env node
/**
 * Mints the classic Supabase API keys: HS256 JWTs carrying a `role` claim,
 * signed with JWT_SECRET. These are what @supabase/supabase-js expects, and
 * what PostgREST, GoTrue, Realtime and Storage verify against.
 *
 * Dependency-free on purpose — provision.sh runs before any npm install, and
 * node:crypto is all this needs.
 *
 * Usage: node mint-jwt.mjs <jwt-secret> <anon|service_role> [years]
 */
import { createHmac } from 'node:crypto';

const [, , secret, role, yearsArg] = process.argv;

if (!secret || !role) {
	console.error('usage: mint-jwt.mjs <jwt-secret> <anon|service_role> [years]');
	process.exit(1);
}

if (role !== 'anon' && role !== 'service_role') {
	console.error(`unsupported role: ${role}`);
	process.exit(1);
}

const years = Number(yearsArg ?? 10);
const issuedAt = Math.floor(Date.now() / 1000);

const base64url = (value) => Buffer.from(value).toString('base64url');

const segments = [
	base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
	base64url(
		JSON.stringify({
			role,
			iss: 'supabase',
			iat: issuedAt,
			exp: issuedAt + Math.round(years * 365.25 * 24 * 60 * 60)
		})
	)
];

const signature = createHmac('sha256', secret).update(segments.join('.')).digest('base64url');

process.stdout.write(`${segments.join('.')}.${signature}`);
