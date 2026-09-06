import { createOAuthAction, getOAuthAvailability } from '$lib/server/oauth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	return {
		next: url.searchParams.get('next') ?? '/',
		oauth: getOAuthAvailability()
	};
};

export const actions = {
	signup: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		if (!email || !password) {
			return { message: 'Email and password are required' };
		}

		if (password.length < 6) {
			return { message: 'Password must be at least 6 characters' };
		}

		const { error } = await supabase.auth.signUp({ email, password });

		if (error) {
			return { message: error.message };
		}

		return { success: true, confirmEmail: true };
	},

	google: createOAuthAction('google'),
	facebook: createOAuthAction('facebook')
} satisfies Actions;
