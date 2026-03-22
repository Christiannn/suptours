<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<div class="profile-edit-page">
	<h1>Edit profile</h1>

	<form method="POST" enctype="multipart/form-data" use:enhance class="profile-form">
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

		<label for="avatar_file">Profile image</label>
		{#if data.profile?.avatar_url}
			<div class="avatar-preview">
				<img src={data.profile.avatar_url} alt="Current profile avatar" loading="lazy" />
				<span>Current image</span>
			</div>
		{/if}
		<input id="avatar_file" name="avatar_file" type="file" accept="image/*" />
		<p class="field-note">Upload a new image to replace the current avatar (max 3MB).</p>

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

	.avatar-preview {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--color-border-light);
		border-radius: var(--border-radius);
		background: var(--color-bg-muted);
		width: fit-content;
	}

	.avatar-preview img {
		width: 44px;
		height: 44px;
		border-radius: var(--border-radius-full);
		object-fit: cover;
		border: 1px solid var(--color-border);
	}

	.avatar-preview span {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.field-note {
		margin: -0.3rem 0 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
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
