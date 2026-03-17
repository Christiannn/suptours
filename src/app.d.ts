import type { Database } from '$lib/database.types';
import { createServerClient } from '@supabase/ssr';
import type { Session, User } from '@supabase/supabase-js';
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			supabase: ReturnType<typeof createServerClient<Database>>;
			safeGetSession(): Promise<{
				session: Session | null;
				user: User | null;
			}>;
		}
		interface PageData {
			session?: Session | null;
			user?: User | null;
			form?: Record<string, unknown>;
		}
	}
		// interface Error {}
		// interface PageState {}
		// interface Platform {}
}

export {};
