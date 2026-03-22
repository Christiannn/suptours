<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<div class="profile-page">
	<h1>Profile</h1>

	{#if data.profile?.avatar_url}
		<div class="profile-avatar-large-wrap">
			<img src={data.profile.avatar_url} alt="Profile avatar" class="profile-avatar-large" />
		</div>
	{/if}

	{#if data.profileError}
		<p class="message error">{data.profileError}</p>
	{/if}

	{#if data.profile}
		<dl class="profile-details">
			<dt>Display name</dt>
			<dd>{data.profile.display_name ?? '—'}</dd>
			<dt>Name</dt>
			<dd>{data.profile.name ?? '—'}</dd>
			<dt>Country</dt>
			<dd>{data.profile.country ?? '—'}</dd>
			<dt>City</dt>
			<dd>{data.profile.city ?? '—'}</dd>
			<dt>Email</dt>
			<dd>{data.user?.email ?? '—'}</dd>
		</dl>
		<a href={resolve('/profile/edit')} class="button-link">Edit profile</a>
	{:else}
		<p>No profile found. <a href={resolve('/profile/edit')}>Create one</a></p>
	{/if}

	<section class="team-section">
		<div class="section-header">
			<h2>Team Management</h2>
			<a href={resolve('/team')} class="button-link secondary">Open Team Manager</a>
		</div>

		<p class="team-help">
			Team CRUD is managed through the Team module UI, available from here to keep backend modules isolated.
		</p>

		{#if data.teamError}
			<p class="message error">{data.teamError}</p>
		{/if}

		{#if data.teams.length > 0}
			<ul class="team-list">
				{#each data.teams as team (team.id)}
					<li>
						<a href={resolve('/team/[id]', { id: team.id })}>{team.name}</a>
						{#if team.canManage}
							<span class="badge">Manage</span>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty">No teams yet. Use "Open Team Manager" to create one.</p>
		{/if}
	</section>
</div>

<style>
	.profile-page {
		max-width: 44rem;
		padding: var(--section-padding);
	}

	.profile-details {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.5rem 1.5rem;
		margin-bottom: 1rem;
	}

	.profile-avatar-large-wrap {
		margin: 0 0 1rem;
	}

	.profile-avatar-large {
		width: min(11rem, 44vw);
		aspect-ratio: 1 / 1;
		display: block;
		object-fit: cover;
		border-radius: var(--border-radius-sm);
		border: 2px solid var(--color-border);
		background: var(--color-bg-muted);
		box-shadow: var(--shadow-card);
	}

	.profile-details dt {
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.profile-details dd {
		margin: 0;
	}

	.button-link {
		display: inline-block;
		padding: var(--form-padding);
		background: var(--color-accent);
		color: white;
		border-radius: var(--border-radius);
		text-decoration: none;
	}

	.button-link:hover {
		background: var(--color-accent-hover);
		text-decoration: none;
	}

	.button-link.secondary {
		background: transparent;
		color: var(--color-accent);
		border: var(--border-width) solid var(--color-accent);
	}

	.button-link.secondary:hover {
		background: var(--color-accent);
		color: var(--color-bg);
	}

	.team-section {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: var(--border-width) solid var(--color-border);
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.team-help {
		margin: 0.75rem 0 1rem;
		color: var(--color-text-muted);
	}

	.team-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.team-list li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
		border-bottom: var(--border-width) solid var(--color-border);
	}

	.badge {
		font-size: var(--font-size-xs);
		background: var(--color-bg-muted);
		padding: 0.125rem 0.5rem;
		border-radius: var(--border-radius-sm);
	}

	.message.error,
	.empty {
		color: var(--color-error);
	}

	.empty {
		color: var(--color-text-muted);
	}
</style>
