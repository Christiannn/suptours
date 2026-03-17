import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	return { next: url.searchParams.get('next') ?? '/' };
};

export const actions = {
	signup: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const next = (formData.get('next') as string) ?? '/';

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

		redirect(303, next);
	}
} satisfies Actions;
