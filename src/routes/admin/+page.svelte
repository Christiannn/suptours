<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<section class="admin-home">
	<h1>Admin</h1>
	<p>Choose an admin module.</p>
	<nav class="admin-links">
		<a href={resolve('/admin/gallary')}>Gallary management</a>
		<a href={resolve('/admin/blog/new')}>New blog post</a>
		<a href={resolve('/admin/community')}>Community moderation</a>
	</nav>

	<section class="agent-intents" aria-labelledby="agent-intents-heading">
		<h2 id="agent-intents-heading">Agent intent log</h2>
		<p class="agent-intents__hint">
			GET <code>/api/x-bot-agent-intent?…</code> — query string is stored (max 2 req/s per IP). Example:
			<code>?q=beginner+tours+Copenhagen&notes=weekend</code>
		</p>
		{#if data.loadError}
			<p class="agent-intents__err" role="alert">Could not load: {data.loadError}</p>
		{:else if data.agentIntentLogs.length === 0}
			<p class="agent-intents__empty">No log entries yet.</p>
		{:else}
			<ul class="agent-intents__list">
				{#each data.agentIntentLogs as row (row.id)}
					<li class="agent-card">
						<header class="agent-card__meta">
							<time datetime={row.created_at}>{new Date(row.created_at).toLocaleString()}</time>
							<form method="POST" action="?/deleteAgentIntentLog" use:enhance>
								<input type="hidden" name="id" value={row.id} />
								<button type="submit" class="agent-card__delete">Delete</button>
							</form>
						</header>
						<dl class="agent-card__fields">
							{#if row.intent_summary}
								<div>
									<dt>Intent (summary)</dt>
									<dd>{row.intent_summary}</dd>
								</div>
							{/if}
							<div>
								<dt>Query params</dt>
								<dd class="agent-card__mono agent-card__pre">
									{JSON.stringify(row.query_params, null, 2)}
								</dd>
							</div>
							{#if row.raw_query}
								<div>
									<dt>Raw query string</dt>
									<dd class="agent-card__mono">{row.raw_query}</dd>
								</div>
							{/if}
							{#if row.referrer}
								<div>
									<dt>Referrer</dt>
									<dd class="agent-card__mono">{row.referrer}</dd>
								</div>
							{/if}
							{#if row.user_agent}
								<div>
									<dt>User-Agent</dt>
									<dd class="agent-card__mono">{row.user_agent}</dd>
								</div>
							{/if}
						</dl>
					</li>
				{/each}
			</ul>
		{/if}
		{#if form?.error}
			<p class="agent-intents__err" role="alert">{form.error}</p>
		{/if}
	</section>
</section>

<style>
	.admin-home {
		padding: var(--section-padding);
		max-width: 52rem;
	}

	.admin-links {
		display: grid;
		gap: 0.5rem;
		margin-bottom: 2rem;
	}

	.agent-intents__hint {
		font-size: 0.9rem;
		color: var(--color-text-muted, #5c5c5c);
		margin-bottom: 1rem;
	}

	.agent-intents__hint code {
		font-size: 0.85em;
	}

	.agent-intents__empty,
	.agent-intents__err {
		margin: 0.5rem 0;
	}

	.agent-intents__err {
		color: var(--color-danger, #b00020);
	}

	.agent-intents__list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.agent-card {
		border: 1px solid var(--color-border, #e0e0e0);
		border-radius: var(--radius-md, 8px);
		padding: 1rem;
		background: var(--color-surface, #fafafa);
	}

	.agent-card__meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
		font-size: 0.85rem;
		color: var(--color-text-muted, #5c5c5c);
	}

	.agent-card__delete {
		font: inherit;
		font-size: 0.8rem;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		border: 1px solid var(--color-border, #ccc);
		border-radius: 4px;
		background: #fff;
	}

	.agent-card__delete:hover {
		border-color: var(--color-danger, #b00020);
		color: var(--color-danger, #b00020);
	}

	.agent-card__fields {
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}

	.agent-card__fields dt {
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--color-text-muted, #666);
	}

	.agent-card__fields dd {
		margin: 0.15rem 0 0;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.agent-card__mono {
		font-size: 0.8rem;
		font-family: ui-monospace, monospace;
	}

	.agent-card__pre {
		white-space: pre-wrap;
	}
</style>
