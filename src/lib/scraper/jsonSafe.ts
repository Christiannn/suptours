/**
 * jsonSafe.ts
 *
 * Konvertér vilkårlige objekter til en værdi der kan gemmes i en
 * `jsonb`-kolonne.
 *
 * To grunde til at det ikke bare er en type-cast:
 *   1. Supabase' genererede `Json`-type accepterer ikke navngivne
 *      interfaces (de mangler index-signatur), selvom de er 100 %
 *      serialiserbare.
 *   2. Runtime-værdier som `undefined`, `Date` og cirkulære referencer
 *      skal væk, før de rammer databasen.
 */

import type { Json } from '$lib/database.types';

export function toJson(value: unknown): Json {
	try {
		return JSON.parse(JSON.stringify(value ?? null)) as Json;
	} catch {
		// Cirkulær reference eller lignende — log hellere ingenting end at
		// vælte den kørsel vi netop var ved at journalisere.
		return null;
	}
}
