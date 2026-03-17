import { requireUser } from '$lib/auth/requireUser';
import type { PageServerLoad } from './$types';

export const load = (async (event) => {
	const { user } = await requireUser(event);
	const { supabase } = event.locals;

	const { data: profile, error: profileError } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', user.id)
		.maybeSingle();

	const { data: memberships, error: teamError } = await supabase
		.from('team_members')
		.select('team_id, role_id, teams(id, name, created_by), team_roles(content_edit_level)')
		.eq('user_id', user.id);

	type TeamMembership = {
		teams: { id: string; name: string; created_by: string } | null;
		team_roles: { content_edit_level: string } | null;
	};

	const teams =
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

	return {
		user,
		profile: profile ?? null,
		teams,
		profileError: profileError ? 'Could not load profile data.' : null,
		teamError: teamError ? 'Could not load teams right now.' : null
	};
}) satisfies PageServerLoad;
