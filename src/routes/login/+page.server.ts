import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	return { next: url.searchParams.get('next') ?? '/' };
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

	google: async ({ locals: { supabase }, url }) => {
		const { data, error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${url.origin}/auth/callback` }
		});

		if (error) {
			return { message: error.message };
		}

		if (data.url) {
			redirect(303, data.url);
		}
	},

	facebook: async ({ locals: { supabase }, url }) => {
		const { data, error } = await supabase.auth.signInWithOAuth({
			provider: 'facebook',
			options: { redirectTo: `${url.origin}/auth/callback` }
		});

		if (error) {
			return { message: error.message };
		}

		if (data.url) {
			redirect(303, data.url);
		}
	}
} satisfies Actions;
