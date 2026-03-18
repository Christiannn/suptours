<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	let { form } = $props();

	let title = $state('');
	let slug = $state('');
	let slugTouched = $state(false);
	let content_md = $state('');

	const snippets = [
		{ label: '# title', insert: '# ' },
		{ label: '## subtitle', insert: '## ' },
		{ label: '**bold**', insert: '**text**' },
		{ label: '*italic*', insert: '*text*' },
		{ label: '- list', insert: '- ' },
		{ label: '[link](url)', insert: '[link text](url)' },
		{ label: '![alt](url)', insert: '![](url)' }
	];

	function insertSnippet(snippet: string) {
		const prefix = content_md ? '\n' : '';
		content_md = content_md + prefix + snippet;
	}

	function slugify(text: string): string {
		return text
			.toLowerCase()
			.trim()
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function onTitleInput() {
		if (!slugTouched && title) {
			slug = slugify(title);
		}
	}
</script>

<div class="blog-edit-page">
	<h1>New post</h1>

	<form method="POST" use:enhance class="blog-form">
		<label for="title">Title</label>
		<input id="title" name="title" type="text" bind:value={title} oninput={onTitleInput} required />

		<div class="meta-row">
			<label for="slug" class="meta-label">Path</label>
			<input
				id="slug"
				name="slug"
				type="text"
				class="meta-input"
				bind:value={slug}
				onfocus={() => (slugTouched = true)}
				required
				placeholder="my-post-title"
			/>
		</div>

		<label for="content_md">Content (Markdown)</label>
		<textarea
			id="content_md"
			name="content_md"
			bind:value={content_md}
			rows="12"
		></textarea>
		<p class="md-guide">
			{#each snippets as s, i (s.label)}
				<button type="button" class="md-snippet" onclick={() => insertSnippet(s.insert)}>{s.label}</button>
				{#if i < snippets.length - 1}
					<span class="md-sep">·</span>
				{/if}
			{/each}
		</p>

		{#if form?.message}
			<p class="message error">{form.message}</p>
		{/if}

		<div class="form-actions">
			<button type="submit" class="primary">Create</button>
			<a href={resolve('/blog')}>Cancel</a>
		</div>
	</form>
</div>

<style>
	.blog-edit-page {
		max-width: 48rem;
		padding: var(--section-padding);
	}

	.blog-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.blog-form label {
		font-weight: 500;
	}

	.blog-form input,
	.blog-form textarea {
		width: 100%;
	}

	.meta-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: -0.5rem;
	}

	.meta-label {
		font-size: var(--font-size-xs);
		font-weight: 400;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.meta-input {
		font-size: var(--font-size-xs);
		width: auto;
		min-width: 10rem;
		max-width: 16rem;
		padding: 0.25rem 0.5rem;
	}

	.blog-form textarea {
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
	}

	.md-guide {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		margin: -0.5rem 0 0;
		line-height: 1.4;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
	}

	.md-snippet {
		background: none;
		border: none;
		padding: 0;
		font-size: inherit;
		color: inherit;
		cursor: pointer;
		text-decoration: underline;
	}

	.md-snippet:hover {
		color: var(--color-accent);
	}

	.md-sep {
		opacity: 0.6;
		pointer-events: none;
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
