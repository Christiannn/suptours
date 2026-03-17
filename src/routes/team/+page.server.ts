import { requireUser } from '$lib/auth/requireUser';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load = (async (event) => {
	const { user } = await requireUser(event);
	const { supabase } = event.locals;

	const { data: memberships } = await supabase
		.from('team_members')
		.select('team_id, role_id, teams(id, name, created_by), team_roles(content_edit_level)')
		.eq('user_id', user.id);

	type TeamMembership = {
		teams: { id: string; name: string; created_by: string } | null;
		team_roles: { content_edit_level: string } | null;
	};

	const teamList =
		memberships
			?.map((membership: TeamMembership) => {
				const team = membership.teams;
				if (!team) return null;
				const isCreator = team.created_by === user.id;
				const isSuper = membership.team_roles?.content_edit_level === 'super';
				return {
					...team,
					canManage: isCreator || isSuper
				};
			})
			.filter((team): team is NonNullable<typeof team> => team != null) ?? [];

	return { teams: teamList, user };
}) satisfies PageServerLoad;

export const actions = {
	create: async (event) => {
		const { request, locals: { supabase } } = event;
		const { user } = await requireUser(event);
		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim();

		if (!name) {
			return fail(400, { message: 'Team name is required.' });
		}

		const { data: team, error } = await supabase
			.from('teams')
			.insert({ name, created_by: user.id })
			.select('id')
			.single();

		if (error) {
			return fail(500, { message: 'Could not create team. Please try again.' });
		}

		redirect(303, `/team/${team.id}`);
	},
	update: async (event) => {
		const { request, locals: { supabase } } = event;
		const { user } = await requireUser(event);
		const formData = await request.formData();
		const teamId = (formData.get('team_id') as string)?.trim();
		const name = (formData.get('name') as string)?.trim();

		if (!teamId || !name) {
			return fail(400, { message: 'Team and name are required.' });
		}

		const { data: canManage, error: canManageErr } = await supabase.rpc('user_can_manage_team', {
			p_team_id: teamId,
			p_user_id: user.id
		});

		if (canManageErr || !canManage) {
			return fail(403, { message: 'You are not allowed to update this team.' });
		}

		const { error: updateErr } = await supabase.from('teams').update({ name }).eq('id', teamId);

		if (updateErr) {
			return fail(500, { message: 'Could not update team.' });
		}

		return { message: 'Team updated.', success: true };
	},
	delete: async (event) => {
		const { request, locals: { supabase } } = event;
		const { user } = await requireUser(event);
		const formData = await request.formData();
		const teamId = (formData.get('team_id') as string)?.trim();

		if (!teamId) {
			return fail(400, { message: 'Team is required.' });
		}

		const { data: canManage, error: canManageErr } = await supabase.rpc('user_can_manage_team', {
			p_team_id: teamId,
			p_user_id: user.id
		});

		if (canManageErr || !canManage) {
			return fail(403, { message: 'You are not allowed to delete this team.' });
		}

		const { error: deleteErr } = await supabase.from('teams').delete().eq('id', teamId);

		if (deleteErr) {
			return fail(500, { message: 'Could not delete team.' });
		}

		return { message: 'Team deleted.', success: true };
	}
} satisfies Actions;
