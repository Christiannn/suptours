<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<div class="team-detail-page">
	<h1>{data.team.name}</h1>
	<a href={resolve('/team')} class="back-link">← Back to teams</a>

	{#if data.canManage}
		<section class="section">
			<h2>Add member</h2>
			<form method="POST" action="?/addMember" use:enhance class="add-member-form">
				<input name="email" type="email" placeholder="user@example.com" required />
				<select name="role_id" required>
					{#each data.team.team_roles ?? [] as role (role.id)}
						<option value={role.id}>{role.name} ({role.content_edit_level})</option>
					{/each}
				</select>
				<button type="submit" class="primary">Add</button>
			</form>
			{#if form?.addMessage}
				<p class="message" class:success={form?.addSuccess}>{form.addMessage}</p>
			{/if}
		</section>

		<section class="section">
			<details class="roles-collapse">
				<summary class="roles-collapse__summary">Team roles</summary>
				<ul class="role-list">
					{#each data.team.team_roles ?? [] as role (role.id)}
						<li>
							<form method="POST" action="?/updateRoleDef" use:enhance class="role-edit-form">
								<input type="hidden" name="role_id" value={role.id} />
								<input name="role_name" value={role.name} aria-label="Role name" required />
								<input
									name="role_description"
									value={role.description ?? ''}
									aria-label="Role description"
									placeholder="Description"
								/>
								<select name="content_edit_level">
									<option value="read" selected={role.content_edit_level === 'read'}>read</option>
									<option value="edit" selected={role.content_edit_level === 'edit'}>edit</option>
									<option value="super" selected={role.content_edit_level === 'super'}>super</option>
								</select>
								<button type="submit">Save role</button>
							</form>
							<form method="POST" action="?/deleteRole" use:enhance class="inline-form role-delete-form">
								<input type="hidden" name="role_id" value={role.id} />
								<button type="submit" class="danger">Delete role</button>
							</form>
						</li>
					{/each}
				</ul>
				<form method="POST" action="?/createRole" use:enhance class="create-role-form">
					<input name="role_name" placeholder="Role name" required />
					<input name="role_description" placeholder="Description (optional)" />
					<select name="content_edit_level">
						<option value="read">read</option>
						<option value="edit">edit</option>
						<option value="super">super</option>
					</select>
					<button type="submit" class="primary">Create role</button>
				</form>
				{#if form?.roleCreateMessage}
					<p class="message" class:success={form?.roleCreateSuccess}>{form.roleCreateMessage}</p>
				{/if}
				{#if form?.roleEditMessage}
					<p class="message" class:success={form?.roleEditSuccess}>{form.roleEditMessage}</p>
				{/if}
				{#if form?.roleDeleteMessage}
					<p class="message" class:success={form?.roleDeleteSuccess}>{form.roleDeleteMessage}</p>
				{/if}
			</details>
		</section>
	{/if}

	<section class="section">
		<h2>Members</h2>
		<ul class="member-list">
			{#each data.team.team_members ?? [] as member (member.id)}
				<li>
					<span>{member.profiles?.display_name ?? member.invited_email ?? 'Unknown'}</span>
					<span class="member-role">{member.team_roles?.name ?? '—'}</span>
					{#if data.canManage && member.user_id !== data.user?.id}
						<form method="POST" action="?/updateRole" use:enhance class="inline-form">
							<input type="hidden" name="member_id" value={member.id} />
							<select name="role_id">
								{#each data.team.team_roles ?? [] as role (role.id)}
									<option value={role.id} selected={member.role_id === role.id}>
										{role.name}
									</option>
								{/each}
							</select>
							<button type="submit">Update</button>
						</form>
						<form method="POST" action="?/removeMember" use:enhance class="inline-form">
							<input type="hidden" name="member_id" value={member.id} />
							<button type="submit" class="danger">Remove</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
		{#if form?.roleMessage}
			<p class="message" class:success={form?.roleSuccess}>{form.roleMessage}</p>
		{/if}
		{#if form?.removeMessage}
			<p class="message" class:success={form?.removeSuccess}>{form.removeMessage}</p>
		{/if}
		{#if form?.addMessage}
			<p class="message" class:success={form?.addSuccess}>{form.addMessage}</p>
		{/if}
	</section>
</div>

<style>
	.team-detail-page {
		padding: var(--section-padding);
		max-width: 74rem;
	}

	.back-link {
		display: inline-block;
		margin-bottom: 1rem;
		font-size: var(--font-size-sm);
	}

	.section {
		margin-bottom: 2rem;
	}

	.add-member-form,
	.create-role-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.role-edit-form {
		display: inline-flex;
		flex-wrap: nowrap;
		gap: 0.5rem;
		align-items: center;
		flex: 1;
		min-width: 42rem;
	}

	.add-member-form input,
	.create-role-form input {
		min-width: 10rem;
	}

	.add-member-form :is(input, select, button),
	.create-role-form :is(input, select, button),
	.role-edit-form :is(input, select, button),
	.inline-form :is(select, button) {
		height: 2.125rem;
	}

	.add-member-form button,
	.create-role-form button,
	.role-edit-form button,
	.inline-form button {
		display: inline-flex;
		align-items: center;
	}

	.role-list,
	.member-list {
		list-style: none;
		padding: 0;
		margin: 0 0 1rem;
	}

	.role-list li,
	.member-list li {
		padding: 0.5rem 0;
		border-bottom: var(--border-width) solid var(--color-border);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.role-list li {
		flex-wrap: nowrap;
		overflow-x: auto;
	}

	.member-role {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.inline-form {
		display: inline-flex;
		gap: 0.25rem;
		margin-left: auto;
		align-items: center;
	}

	.role-delete-form {
		margin-left: 0;
	}

	.role-edit-form input[name='role_name'] {
		min-width: 10rem;
	}

	.role-edit-form input[name='role_description'] {
		min-width: 16rem;
	}

	.roles-collapse {
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
		padding: 0.5rem 0.75rem;
	}

	.roles-collapse__summary {
		cursor: pointer;
		font-weight: 700;
		user-select: none;
	}

	.roles-collapse[open] .roles-collapse__summary {
		margin-bottom: 0.75rem;
	}

	.message {
		margin: 0.25rem 0;
		font-size: var(--font-size-sm);
	}

	.message.success {
		color: var(--color-success);
	}

	button.danger {
		color: var(--color-error);
	}
</style>
