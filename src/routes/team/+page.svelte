<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<div class="team-page">
	<h1>Teams</h1>

	<form method="POST" action="?/create" use:enhance class="create-form">
		<input name="name" type="text" placeholder="Team name" required />
		<button type="submit" class="primary">Create team</button>
	</form>

	{#if form?.message}
		<p class="message" class:success={form.success}>{form.message}</p>
	{/if}

	<h2>Your teams</h2>
	{#if data.teams.length > 0}
		<ul class="team-list">
			{#each data.teams as team (team.id)}
				<li>
					<div class="team-name-cell">
						<a href={resolve('/team/[id]', { id: team.id })}>{team.name}</a>
						{#if team.created_by === data.user?.id}
							<span class="badge">Creator</span>
						{/if}
					</div>
					{#if team.canManage}
						<form method="POST" action="?/update" use:enhance class="rename-form">
							<input type="hidden" name="team_id" value={team.id} />
							<input type="text" name="name" value={team.name} aria-label="Team name" required />
							<button type="submit">Rename</button>
						</form>
						<form method="POST" action="?/delete" use:enhance class="delete-form">
							<input type="hidden" name="team_id" value={team.id} />
							<button type="submit" class="danger">Delete</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="no-teams">No teams yet. Create one above.</p>
	{/if}
</div>

<style>
	.team-page {
		padding: var(--section-padding);
		max-width: 40rem;
	}

	.create-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.create-form input {
		flex: 1;
		min-width: 12rem;
		height: 2.125rem;
	}

	.create-form button {
		height: 2.125rem;
		display: inline-flex;
		align-items: center;
	}

	.message {
		margin: 0 0 1rem;
	}

	.message.success {
		color: var(--color-success);
	}

	.message:not(.success) {
		color: var(--color-error);
	}

	.team-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.team-list li {
		display: grid;
		grid-template-columns: minmax(10rem, 1fr) minmax(12rem, 1.4fr) auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
		border-bottom: var(--border-width) solid var(--color-border);
	}

	.team-name-cell {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.team-name-cell a {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rename-form {
		display: grid;
		grid-template-columns: minmax(10rem, 1fr) auto;
		gap: 0.25rem;
		align-items: center;
	}

	.rename-form input[type='text'] {
		width: 100%;
		min-width: 0;
		height: 2.125rem;
	}

	.rename-form button,
	.delete-form button {
		height: 2.125rem;
		display: inline-flex;
		align-items: center;
	}

	.delete-form {
		justify-self: end;
	}

	button.danger {
		color: var(--color-error);
	}

	.badge {
		font-size: var(--font-size-xs);
		background: var(--color-bg-muted);
		padding: 0.125rem 0.5rem;
		border-radius: var(--border-radius-sm);
	}

	.no-teams {
		color: var(--color-text-muted);
	}
</style>
