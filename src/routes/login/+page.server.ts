import { createOAuthAction, getOAuthAvailability } from '$lib/server/oauth';
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	return {
		next: url.searchParams.get('next') ?? '/',
		oauth: getOAuthAvailability()
	};
};

export const actions = {
	login: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const next = (formData.get('next') as string) ?? '/';

		if (!email || !password) {
			return { message: 'Email and password are required' };
		}

		const { error } = await supabase.auth.signInWithPassword({ email, password });

		if (error) {
			return { message: error.message };
		}

		redirect(303, next);
	},

	google: createOAuthAction('google'),
	facebook: createOAuthAction('facebook')
} satisfies Actions;
