<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { data } = $props();

	const openMarkdownLink = (href: string) => {
		if (/^(https?:)?\/\//i.test(href) || href.startsWith('mailto:')) {
			window.open(href, '_blank', 'noopener,noreferrer');
			return;
		}

		void goto(resolve(href as any));
	};
</script>

<article class="blog-post">
	<h1>{data.post.title}</h1>
	<p class="meta">
		{data.post.created_at ? new Date(data.post.created_at).toLocaleDateString() : ''}
		{#if data.post.profiles}
			by {data.post.profiles.display_name ?? data.post.profiles.name ?? 'Unknown'}
		{/if}
		{#if data.canEdit}
			<a class="edit-link" href={`/admin/blog/edit/${data.post.slug}`}>Edit</a>
		{/if}
	</p>
	<div class="content">
		{#if data.post.content_blocks?.length}
			{#each data.post.content_blocks as block, i (`${block.type}-${i}`)}
				{#if block.type === 'heading'}
					{#if block.level === 1}
						<h1>
							{#each block.inlines as inline, inlineIndex (`h1-${inline.type}-${inlineIndex}`)}
								{#if inline.type === 'text'}
									{inline.text}
								{:else if inline.type === 'strong'}
									<strong>{inline.text}</strong>
								{:else if inline.type === 'em'}
									<em>{inline.text}</em>
								{:else}
									<button type="button" class="markdown-link" onclick={() => openMarkdownLink(inline.href)}>
										{inline.text}
									</button>
								{/if}
							{/each}
						</h1>
					{:else if block.level === 2}
						<h2>
							{#each block.inlines as inline, inlineIndex (`h2-${inline.type}-${inlineIndex}`)}
								{#if inline.type === 'text'}
									{inline.text}
								{:else if inline.type === 'strong'}
									<strong>{inline.text}</strong>
								{:else if inline.type === 'em'}
									<em>{inline.text}</em>
								{:else}
									<button type="button" class="markdown-link" onclick={() => openMarkdownLink(inline.href)}>
										{inline.text}
									</button>
								{/if}
							{/each}
						</h2>
					{:else if block.level === 3}
						<h3>
							{#each block.inlines as inline, inlineIndex (`h3-${inline.type}-${inlineIndex}`)}
								{#if inline.type === 'text'}
									{inline.text}
								{:else if inline.type === 'strong'}
									<strong>{inline.text}</strong>
								{:else if inline.type === 'em'}
									<em>{inline.text}</em>
								{:else}
									<button type="button" class="markdown-link" onclick={() => openMarkdownLink(inline.href)}>
										{inline.text}
									</button>
								{/if}
							{/each}
						</h3>
					{:else if block.level === 4}
						<h4>
							{#each block.inlines as inline, inlineIndex (`h4-${inline.type}-${inlineIndex}`)}
								{#if inline.type === 'text'}
									{inline.text}
								{:else if inline.type === 'strong'}
									<strong>{inline.text}</strong>
								{:else if inline.type === 'em'}
									<em>{inline.text}</em>
								{:else}
									<button type="button" class="markdown-link" onclick={() => openMarkdownLink(inline.href)}>
										{inline.text}
									</button>
								{/if}
							{/each}
						</h4>
					{:else if block.level === 5}
						<h5>
							{#each block.inlines as inline, inlineIndex (`h5-${inline.type}-${inlineIndex}`)}
								{#if inline.type === 'text'}
									{inline.text}
								{:else if inline.type === 'strong'}
									<strong>{inline.text}</strong>
								{:else if inline.type === 'em'}
									<em>{inline.text}</em>
								{:else}
									<button type="button" class="markdown-link" onclick={() => openMarkdownLink(inline.href)}>
										{inline.text}
									</button>
								{/if}
							{/each}
						</h5>
					{:else}
						<h6>
							{#each block.inlines as inline, inlineIndex (`h6-${inline.type}-${inlineIndex}`)}
								{#if inline.type === 'text'}
									{inline.text}
								{:else if inline.type === 'strong'}
									<strong>{inline.text}</strong>
								{:else if inline.type === 'em'}
									<em>{inline.text}</em>
								{:else}
									<button type="button" class="markdown-link" onclick={() => openMarkdownLink(inline.href)}>
										{inline.text}
									</button>
								{/if}
							{/each}
						</h6>
					{/if}
				{:else if block.type === 'paragraph'}
					<p>
						{#each block.inlines as inline, inlineIndex (`p-${inline.type}-${inlineIndex}`)}
							{#if inline.type === 'text'}
								{inline.text}
							{:else if inline.type === 'strong'}
								<strong>{inline.text}</strong>
							{:else if inline.type === 'em'}
								<em>{inline.text}</em>
							{:else}
								<button type="button" class="markdown-link" onclick={() => openMarkdownLink(inline.href)}>
									{inline.text}
								</button>
							{/if}
						{/each}
					</p>
				{:else if block.type === 'blockquote'}
					<blockquote>
						{#each block.inlines as inline, inlineIndex (`quote-${inline.type}-${inlineIndex}`)}
							{#if inline.type === 'text'}
								{inline.text}
							{:else if inline.type === 'strong'}
								<strong>{inline.text}</strong>
							{:else if inline.type === 'em'}
								<em>{inline.text}</em>
							{:else}
								<button type="button" class="markdown-link" onclick={() => openMarkdownLink(inline.href)}>
									{inline.text}
								</button>
							{/if}
						{/each}
					</blockquote>
				{:else if block.type === 'list'}
					{#if block.ordered}
						<ol>
							{#each block.items as item, itemIndex (`ol-item-${itemIndex}`)}
								<li>
									{#each item as inline, inlineIndex (`ol-${inline.type}-${inlineIndex}`)}
										{#if inline.type === 'text'}
											{inline.text}
										{:else if inline.type === 'strong'}
											<strong>{inline.text}</strong>
										{:else if inline.type === 'em'}
											<em>{inline.text}</em>
										{:else}
											<button type="button" class="markdown-link" onclick={() => openMarkdownLink(inline.href)}>
												{inline.text}
											</button>
										{/if}
									{/each}
								</li>
							{/each}
						</ol>
					{:else}
						<ul>
							{#each block.items as item, itemIndex (`ul-item-${itemIndex}`)}
								<li>
									{#each item as inline, inlineIndex (`ul-${inline.type}-${inlineIndex}`)}
										{#if inline.type === 'text'}
											{inline.text}
										{:else if inline.type === 'strong'}
											<strong>{inline.text}</strong>
										{:else if inline.type === 'em'}
											<em>{inline.text}</em>
										{:else}
											<button type="button" class="markdown-link" onclick={() => openMarkdownLink(inline.href)}>
												{inline.text}
											</button>
										{/if}
									{/each}
								</li>
							{/each}
						</ul>
					{/if}
				{:else if block.type === 'code'}
					<pre><code>{block.code}</code></pre>
				{/if}
			{/each}
		{:else}
			<p>No content.</p>
		{/if}
	</div>
</article>

<style>
	.blog-post {
		max-width: 48rem;
		padding: var(--section-padding);
	}

	.blog-post h1 {
		margin-bottom: 0.25rem;
	}

	.meta {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin-bottom: 1.5rem;
	}

	.edit-link {
		margin-left: 1rem;
	}

	.content {
		line-height: var(--line-height-relaxed);
	}

	.content :global(h1),
	.content :global(h2),
	.content :global(h3),
	.content :global(h4),
	.content :global(h5),
	.content :global(h6) {
		margin: 1.25rem 0 0.5rem;
	}

	.content :global(p),
	.content :global(ul),
	.content :global(ol),
	.content :global(blockquote),
	.content :global(pre) {
		margin: 0.75rem 0;
	}

	.content :global(ul),
	.content :global(ol) {
		padding-left: 1.25rem;
	}

	.content :global(code) {
		background: var(--color-bg-muted);
		padding: 0.1rem 0.3rem;
		border-radius: var(--border-radius-sm);
	}

	.content :global(pre) {
		background: var(--color-bg-muted);
		padding: 0.75rem;
		border-radius: var(--border-radius-sm);
		overflow-x: auto;
	}

	.markdown-link {
		background: transparent;
		border: none;
		padding: 0;
		margin: 0;
		font: inherit;
		color: var(--color-accent);
		text-decoration: underline;
		cursor: pointer;
	}
</style>
