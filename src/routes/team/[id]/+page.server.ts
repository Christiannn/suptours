import { requireUser } from '$lib/auth/requireUser';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const userCanManageTeam = async (supabase: App.Locals['supabase'], teamId: string, userId: string) => {
	const { data, error: canManageErr } = await supabase.rpc('user_can_manage_team', {
		p_team_id: teamId,
		p_user_id: userId
	});

	return !canManageErr && Boolean(data);
};

export const load = (async (event) => {
	const { user } = await requireUser(event);
	const { params, locals: { supabase } } = event;

	const { data: team, error: teamErr } = await supabase
		.from('teams')
		.select('*, team_roles(*), team_members(*, profiles(display_name), team_roles(name, content_edit_level))')
		.eq('id', params.id)
		.single();

	if (teamErr || !team) {
		error(404, 'Team not found');
	}

	const canManage = await userCanManageTeam(supabase, params.id, user.id);

	return { team, user, canManage };
}) satisfies PageServerLoad;

export const actions = {
	addMember: async (event) => {
		const { request, params, locals: { supabase } } = event;
		const { user } = await requireUser(event);
		const formData = await request.formData();
		const email = (formData.get('email') as string)?.trim().toLowerCase();
		const roleId = formData.get('role_id') as string;

		const canManage = await userCanManageTeam(supabase, params.id, user.id);
		if (!canManage) {
			return fail(403, { addMessage: 'You are not allowed to add members.' });
		}

		if (!email || !roleId) {
			return fail(400, { addMessage: 'Email and role are required.' });
		}

		const { data: role, error: roleErr } = await supabase
			.from('team_roles')
			.select('id')
			.eq('id', roleId)
			.eq('team_id', params.id)
			.single();

		if (roleErr || !role) {
			return fail(400, { addMessage: 'Selected role is invalid for this team.' });
		}

		const { data: userId, error: lookupErr } = await supabase.rpc('get_user_id_by_email', {
			p_email: email
		});

		if (lookupErr) {
			return fail(500, { addMessage: 'Could not look up email.' });
		}

		if (!userId) {
			const { data: existingInvite } = await supabase
				.from('team_members')
				.select('id')
				.eq('team_id', params.id)
				.eq('invited_email', email)
				.is('user_id', null)
				.maybeSingle();

			if (existingInvite) {
				return fail(409, { addMessage: 'Invitation already exists for this email.' });
			}

			const { error: inviteErr } = await supabase.from('team_members').insert({
				team_id: params.id,
				user_id: null,
				invited_email: email,
				role_id: roleId
			});

			if (inviteErr) {
				return fail(500, { addMessage: 'Could not create invitation.' });
			}

			return { addMessage: 'Invitation created.', addSuccess: true };
		}

		const { error: insertErr } = await supabase
			.from('team_members')
			.insert({ team_id: params.id, user_id: userId, invited_email: email, role_id: roleId });

		if (insertErr) {
			if (insertErr.code === '23505') {
				return fail(409, { addMessage: 'User is already a member.' });
			}
			return fail(500, { addMessage: 'Could not add member.' });
		}

		return { addMessage: 'Member added.', addSuccess: true };
	},
	updateRole: async (event) => {
		const { request, params, locals: { supabase } } = event;
		const { user } = await requireUser(event);
		const formData = await request.formData();
		const memberId = formData.get('member_id') as string;
		const roleId = formData.get('role_id') as string;

		const canManage = await userCanManageTeam(supabase, params.id, user.id);
		if (!canManage) {
			return fail(403, { roleMessage: 'You are not allowed to update member roles.' });
		}

		if (!memberId || !roleId) {
			return fail(400, { roleMessage: 'Member and role are required.' });
		}

		const { data: role, error: roleErr } = await supabase
			.from('team_roles')
			.select('id')
			.eq('id', roleId)
			.eq('team_id', params.id)
			.single();

		if (roleErr || !role) {
			return fail(400, { roleMessage: 'Selected role is invalid for this team.' });
		}

		const { error: updateErr } = await supabase
			.from('team_members')
			.update({ role_id: roleId })
			.eq('id', memberId)
			.eq('team_id', params.id);

		if (updateErr) {
			return fail(500, { roleMessage: 'Could not update role.' });
		}

		return { roleMessage: 'Role updated.', roleSuccess: true };
	},
	removeMember: async (event) => {
		const { request, params, locals: { supabase } } = event;
		const { user } = await requireUser(event);
		const formData = await request.formData();
		const memberId = formData.get('member_id') as string;

		const canManage = await userCanManageTeam(supabase, params.id, user.id);
		if (!canManage) {
			return fail(403, { removeMessage: 'You are not allowed to remove members.' });
		}

		if (!memberId) {
			return fail(400, { removeMessage: 'Member is required.' });
		}

		const { data: member, error: memberErr } = await supabase
			.from('team_members')
			.select('id, user_id')
			.eq('id', memberId)
			.eq('team_id', params.id)
			.single();

		if (memberErr || !member) {
			return fail(404, { removeMessage: 'Member not found.' });
		}

		if (member.user_id === user.id) {
			return fail(400, { removeMessage: 'You cannot remove yourself from this page.' });
		}

		const { error: deleteErr } = await supabase
			.from('team_members')
			.delete()
			.eq('id', memberId)
			.eq('team_id', params.id);

		if (deleteErr) {
			return fail(500, { removeMessage: 'Could not remove member.' });
		}

		return { removeMessage: 'Member removed.', removeSuccess: true };
	},
	createRole: async (event) => {
		const { request, params, locals: { supabase } } = event;
		const { user } = await requireUser(event);
		const formData = await request.formData();
		const name = (formData.get('role_name') as string)?.trim();
		const description = (formData.get('role_description') as string)?.trim() || null;
		const contentEditLevel = (formData.get('content_edit_level') as 'read' | 'edit' | 'super') ?? 'read';

		const canManage = await userCanManageTeam(supabase, params.id, user.id);
		if (!canManage) {
			return fail(403, { roleCreateMessage: 'You are not allowed to create roles.' });
		}

		if (!name) {
			return fail(400, { roleCreateMessage: 'Role name is required.' });
		}

		const { error: insertErr } = await supabase.from('team_roles').insert({
			team_id: params.id,
			name,
			description,
			content_edit_level: contentEditLevel
		});

		if (insertErr) {
			if (insertErr.code === '23505') {
				return fail(409, { roleCreateMessage: 'Role with this name already exists.' });
			}
			return fail(500, { roleCreateMessage: 'Could not create role.' });
		}

		return { roleCreateMessage: 'Role created.', roleCreateSuccess: true };
	},
	updateRoleDef: async (event) => {
		const { request, params, locals: { supabase } } = event;
		const { user } = await requireUser(event);
		const formData = await request.formData();
		const roleId = (formData.get('role_id') as string)?.trim();
		const name = (formData.get('role_name') as string)?.trim();
		const description = ((formData.get('role_description') as string)?.trim() || null) as string | null;
		const contentEditLevel = ((formData.get('content_edit_level') as 'read' | 'edit' | 'super') ??
			'read') as 'read' | 'edit' | 'super';

		const canManage = await userCanManageTeam(supabase, params.id, user.id);
		if (!canManage) {
			return fail(403, { roleEditMessage: 'You are not allowed to update roles.' });
		}

		if (!roleId || !name) {
			return fail(400, { roleEditMessage: 'Role and name are required.' });
		}

		const { data: existingRole, error: roleErr } = await supabase
			.from('team_roles')
			.select('id, content_edit_level')
			.eq('id', roleId)
			.eq('team_id', params.id)
			.single();

		if (roleErr || !existingRole) {
			return fail(404, { roleEditMessage: 'Role not found.' });
		}

		if (existingRole.content_edit_level === 'super' && contentEditLevel !== 'super') {
			const { count: superCount } = await supabase
				.from('team_roles')
				.select('*', { count: 'exact', head: true })
				.eq('team_id', params.id)
				.eq('content_edit_level', 'super');

			if ((superCount ?? 0) <= 1) {
				return fail(400, { roleEditMessage: 'A team must keep at least one super role.' });
			}
		}

		const { error: updateErr } = await supabase
			.from('team_roles')
			.update({ name, description, content_edit_level: contentEditLevel })
			.eq('id', roleId)
			.eq('team_id', params.id);

		if (updateErr) {
			if (updateErr.code === '23505') {
				return fail(409, { roleEditMessage: 'Role name already exists.' });
			}
			return fail(500, { roleEditMessage: 'Could not update role.' });
		}

		return { roleEditMessage: 'Role updated.', roleEditSuccess: true };
	},
	deleteRole: async (event) => {
		const { request, params, locals: { supabase } } = event;
		const { user } = await requireUser(event);
		const formData = await request.formData();
		const roleId = (formData.get('role_id') as string)?.trim();

		const canManage = await userCanManageTeam(supabase, params.id, user.id);
		if (!canManage) {
			return fail(403, { roleDeleteMessage: 'You are not allowed to delete roles.' });
		}

		if (!roleId) {
			return fail(400, { roleDeleteMessage: 'Role is required.' });
		}

		const { data: role, error: roleErr } = await supabase
			.from('team_roles')
			.select('id, content_edit_level')
			.eq('id', roleId)
			.eq('team_id', params.id)
			.single();

		if (roleErr || !role) {
			return fail(404, { roleDeleteMessage: 'Role not found.' });
		}

		if (role.content_edit_level === 'super') {
			const { count: superCount } = await supabase
				.from('team_roles')
				.select('*', { count: 'exact', head: true })
				.eq('team_id', params.id)
				.eq('content_edit_level', 'super');

			if ((superCount ?? 0) <= 1) {
				return fail(400, { roleDeleteMessage: 'A team must keep at least one super role.' });
			}
		}

		const { count: memberCount } = await supabase
			.from('team_members')
			.select('*', { count: 'exact', head: true })
			.eq('team_id', params.id)
			.eq('role_id', roleId);

		if ((memberCount ?? 0) > 0) {
			return fail(400, { roleDeleteMessage: 'Reassign members before deleting this role.' });
		}

		const { error: deleteErr } = await supabase
			.from('team_roles')
			.delete()
			.eq('id', roleId)
			.eq('team_id', params.id);

		if (deleteErr) {
			return fail(500, { roleDeleteMessage: 'Could not delete role.' });
		}

		return { roleDeleteMessage: 'Role deleted.', roleDeleteSuccess: true };
	}
} satisfies Actions;
