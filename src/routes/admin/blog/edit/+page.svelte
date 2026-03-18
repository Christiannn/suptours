<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<div class="blog-edit-page">
	<div class="header">
		<h1>Edit posts</h1>
		<a href={resolve('/blog/new')} class="new-post-link">New post</a>
	</div>

	{#if data.loadError}
		<p class="message error">{data.loadError}</p>
	{/if}

	{#if data.posts.length > 0}
		<ul class="post-list">
			{#each data.posts as post (post.id)}
				<li>
					<div class="post-main">
						<a href={resolve('/blog/edit/[slug]', { slug: post.slug })} class="post-title">{post.title}</a>
						<span class="meta">
							{post.updated_at
								? `Updated ${new Date(post.updated_at).toLocaleDateString()}`
								: post.created_at
									? `Created ${new Date(post.created_at).toLocaleDateString()}`
									: ''}
						</span>
					</div>
					<a href={resolve('/blog/[slug]', { slug: post.slug })} class="view-link">View</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty">You have no posts yet.</p>
	{/if}
</div>

<style>
	.blog-edit-page {
		max-width: 48rem;
		padding: var(--section-padding);
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.new-post-link {
		display: inline-block;
		padding: 0.5rem 1rem;
		background: var(--color-accent);
		color: white;
		border-radius: var(--border-radius);
		text-decoration: none;
		font-size: var(--font-size-sm);
	}

	.new-post-link:hover {
		background: var(--color-accent-hover);
		text-decoration: none;
	}

	.post-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.post-list li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 0;
		border-bottom: var(--border-width) solid var(--color-border);
	}

	.post-list li:last-child {
		border-bottom: none;
	}

	.post-main {
		min-width: 0;
	}

	.post-title {
		font-weight: 500;
		word-break: break-word;
	}

	.meta {
		display: block;
		margin-top: 0.25rem;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.view-link {
		white-space: nowrap;
		font-size: var(--font-size-sm);
	}

	.message.error,
	.empty {
		color: var(--color-text-muted);
	}
</style>
