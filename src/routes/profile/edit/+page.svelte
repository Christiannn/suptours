<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<div class="profile-edit-page">
	<h1>Edit profile</h1>

	<form method="POST" use:enhance class="profile-form">
		<label for="display_name">Display name</label>
		<input
			id="display_name"
			name="display_name"
			type="text"
			value={data.profile?.display_name ?? ''}
			autocomplete="name"
		/>

		<label for="name">Full name</label>
		<input id="name" name="name" type="text" value={data.profile?.name ?? ''} />

		<label for="country">Country</label>
		<input id="country" name="country" type="text" value={data.profile?.country ?? ''} />

		<label for="city">City</label>
		<input id="city" name="city" type="text" value={data.profile?.city ?? ''} />

		<label for="avatar_url">Avatar URL</label>
		<input id="avatar_url" name="avatar_url" type="url" value={data.profile?.avatar_url ?? ''} />

		{#if form?.message}
			<p class="message error">{form.message}</p>
		{/if}

		<div class="form-actions">
			<button type="submit" class="primary">Save</button>
			<a href={resolve('/profile')}>Cancel</a>
		</div>
	</form>
</div>

<style>
	.profile-edit-page {
		max-width: 32rem;
		padding: var(--section-padding);
	}

	.profile-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.profile-form label {
		display: block;
		font-weight: 500;
	}

	.profile-form input {
		width: 100%;
	}

	.message.error {
		color: var(--color-error);
		margin: 0;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		align-items: center;
		margin-top: 0.5rem;
	}
</style>
