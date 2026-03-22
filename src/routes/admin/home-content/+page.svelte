<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<section class="admin-home-content">
	<h1>Home page content</h1>
	<p class="lead">
		Upload an image for the <strong>“Not US Big Tech”</strong> block on the home page (below Upcoming Tours).
	</p>

	{#if data.homeTrustImageUrl}
		<div class="preview">
			<img src={data.homeTrustImageUrl} alt="" class="preview__img" />
			{#if data.homeTrustUpdatedAt}
				<p class="preview__meta">Last updated {new Date(data.homeTrustUpdatedAt).toLocaleString()}</p>
			{/if}
		</div>
	{:else}
		<p class="empty">No image set — the home page will show text only in that section.</p>
	{/if}

	<form
		method="POST"
		action="?/uploadHomeTrustImage"
		use:enhance
		enctype="multipart/form-data"
		class="upload-form"
	>
		<label class="file-label" for="home-trust-file">Replace image</label>
		<input
			id="home-trust-file"
			type="file"
			name="image_file"
			accept="image/*"
			required
			aria-label="Image for home trust section"
		/>
		<button type="submit" class="primary">Upload</button>
	</form>

	{#if data.homeTrustImageUrl}
		<form method="POST" action="?/clearHomeTrustImage" use:enhance class="clear-form">
			<button type="submit" class="danger">Remove image</button>
		</form>
	{/if}

	{#if form?.message}
		<p class="feedback" class:success={form.success} role="status">{form.message}</p>
	{/if}
</section>

<style>
	.admin-home-content {
		padding: var(--section-padding);
		max-width: 40rem;
	}

	.lead {
		color: var(--color-text-muted);
		margin-bottom: 1.25rem;
		line-height: 1.5;
	}

	.preview {
		margin-bottom: 1.25rem;
		border-radius: var(--border-radius-lg);
		overflow: hidden;
		border: 1px solid var(--color-border);
		background: var(--color-bg-muted);
	}

	.preview__img {
		display: block;
		width: 100%;
		max-height: 16rem;
		object-fit: cover;
	}

	.preview__meta {
		margin: 0;
		padding: 0.5rem 0.75rem;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.empty {
		margin: 0 0 1rem;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.upload-form {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.file-label {
		font-weight: 600;
		font-size: var(--font-size-sm);
	}

	.clear-form {
		margin-bottom: 1rem;
	}

	.danger {
		font: inherit;
		font-size: var(--font-size-sm);
		padding: 0.4rem 0.75rem;
		border-radius: var(--border-radius);
		border: 1px solid var(--color-error);
		background: transparent;
		color: var(--color-error);
		cursor: pointer;
	}

	.danger:hover {
		background: rgba(220, 38, 38, 0.08);
	}

	.feedback {
		margin: 0.5rem 0 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.feedback.success {
		color: var(--color-success);
	}
</style>
