import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/auth/requireUser';
import type { Actions, PageServerLoad } from './$types';

export const load = (async (event) => {
	await requireUser(event);
	const { supabase } = event.locals;

	const { data: logs, error } = await supabase
		.from('agent_intent_log')
		.select(
			'id, created_at, intent_summary, query_params, raw_query, referrer, user_agent',
		)
		.order('created_at', { ascending: false })
		.limit(200);

	if (error) {
		console.error('[admin] agent_intent_log', error);
	}

	return {
		agentIntentLogs: logs ?? [],
		loadError: error?.message ?? null,
	};
}) satisfies PageServerLoad;

export const actions = {
	deleteAgentIntentLog: async (event) => {
		const { request, locals: { supabase } } = event;
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Missing id.' });

		const { error: err } = await supabase.from('agent_intent_log').delete().eq('id', id);

		if (err) return fail(500, { error: 'Could not delete.' });
		return { success: true };
	},
} satisfies Actions;
