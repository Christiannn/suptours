<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<div class="blog-list-page">
	<div class="blog-header">
		<h1>Blog</h1>
		{#if data.user}
			<a href={resolve('/admin/blog/new')} class="new-post-link">New post</a>
		{/if}
	</div>

	{#if data.posts.length > 0}
		<ul class="blog-list">
			{#each data.posts as post (post.id)}
				<li>
					<a href={resolve(`/blog/${post.slug}`)}>{post.title}</a>
					<span class="meta">
						{post.created_at ? new Date(post.created_at).toLocaleDateString() : ''}
						{#if post.profiles}
							by {post.profiles.display_name ?? 'Unknown'}
						{/if}
						{#if data.user && data.user.id === post.author_id}
							·
							<a href={resolve(`/admin/blog/edit/${post.slug}`)}>Edit</a>
						{/if}
					</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="no-posts">No posts yet.</p>
	{/if}
</div>

<style>
	.blog-list-page {
		padding: var(--section-padding);
	}

	.blog-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
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

	.blog-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.blog-list li {
		padding: 0.5rem 0;
		border-bottom: var(--border-width) solid var(--color-border);
	}

	.blog-list li:last-child {
		border-bottom: none;
	}

	.blog-list a {
		font-weight: 500;
	}

	.meta {
		display: block;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin-top: 0.25rem;
	}

	.no-posts {
		color: var(--color-text-muted);
	}
</style>
