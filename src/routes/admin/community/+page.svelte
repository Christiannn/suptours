<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	let { data } = $props();

	let activeTab = $state<'subjects' | 'flags'>('subjects');
	let expandedSubject = $state<string | null>(null);

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('en-GB', {
			day: 'numeric', month: 'short', year: 'numeric',
			hour: '2-digit', minute: '2-digit'
		});
	}

	function getFlagCount(type: string, id: string) {
		return data.flagCounts[`${type}:${id}`] ?? 0;
	}

	// Subjects with flags appear first (sorted by flag count desc)
	const sortedSubjects = $derived([...data.subjects].sort((a, b) => {
		const flagsA = getFlagCount('subject', a.id);
		const flagsB = getFlagCount('subject', b.id);
		return flagsB - flagsA || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
	}));
</script>

<svelte:head>
	<title>Community Admin — SUP Tours</title>
</svelte:head>

<div class="admin-comm">
	<div class="admin-comm__header">
		<a href={resolve('/admin')} class="back-link">
			<span class="material-symbols-outlined">arrow_back</span>
			Admin
		</a>
		<h1>Community Moderation</h1>
		<p class="admin-comm__stats">
			{data.subjects.length} subjects ·
			{data.subjects.reduce((n, s) => n + (s.subject_comments?.length ?? 0), 0)} comments ·
			{data.flags.length} open flags
		</p>
	</div>

	<!-- Tabs -->
	<div class="tabs">
		<button
			class="tab"
			class:tab--active={activeTab === 'subjects'}
			onclick={() => activeTab = 'subjects'}
		>
			<span class="material-symbols-outlined">forum</span>
			Subjects & Comments
		</button>
		<button
			class="tab"
			class:tab--active={activeTab === 'flags'}
			onclick={() => activeTab = 'flags'}
		>
			<span class="material-symbols-outlined">flag</span>
			Flags
			{#if data.flags.length > 0}
				<span class="tab__badge">{data.flags.length}</span>
			{/if}
		</button>
	</div>

	<!-- Subjects tab -->
	{#if activeTab === 'subjects'}
		<div class="content-list">
			{#if sortedSubjects.length === 0}
				<p class="empty">No subjects yet.</p>
			{:else}
				{#each sortedSubjects as subject (subject.id)}
					{@const flags = getFlagCount('subject', subject.id)}
					<div class="subject-row" class:subject-row--flagged={flags > 0}>
						<div class="subject-row__top">
							<div class="subject-row__info">
								{#if flags > 0}
									<span class="flag-badge">
										<span class="material-symbols-outlined">flag</span>
										{flags}
									</span>
								{/if}
								<span class="subject-row__author">{subject.profiles?.display_name ?? '—'}</span>
								<span class="subject-row__dot">·</span>
								<span class="subject-row__time">{formatDate(subject.created_at)}</span>
								{#if (subject.subject_comments?.length ?? 0) > 0}
									<span class="subject-row__dot">·</span>
									<span class="subject-row__comments">
										<span class="material-symbols-outlined">comment</span>
										{subject.subject_comments?.length}
									</span>
								{/if}
							</div>
							<div class="subject-row__actions">
								<button
									class="btn-expand"
									onclick={() => expandedSubject = expandedSubject === subject.id ? null : subject.id}
									aria-label="Toggle comments"
								>
									<span class="material-symbols-outlined">
										{expandedSubject === subject.id ? 'expand_less' : 'expand_more'}
									</span>
								</button>
								<a href={resolve(`/community/${subject.id}`)} class="btn-view" target="_blank">
									<span class="material-symbols-outlined">open_in_new</span>
								</a>
								<form method="POST" action="?/deleteSubject" use:enhance
									onsubmit={(e) => { if (!confirm(`Delete "${subject.title}" and all its comments?`)) e.preventDefault(); }}>
									<input type="hidden" name="subject_id" value={subject.id} />
									<button type="submit" class="btn-delete" aria-label="Delete subject">
										<span class="material-symbols-outlined">delete</span>
									</button>
								</form>
							</div>
						</div>

						<h3 class="subject-row__title">{subject.title}</h3>
						<p class="subject-row__body">{subject.body}</p>

						<!-- Comments (expandable) -->
						{#if expandedSubject === subject.id && (subject.subject_comments?.length ?? 0) > 0}
							<div class="comment-list">
								{#each (subject.subject_comments ?? []) as comment (comment.id)}
									{@const commentFlags = getFlagCount('comment', comment.id)}
									<div class="comment-item" class:comment-item--flagged={commentFlags > 0}>
										<div class="comment-item__meta">
											{#if commentFlags > 0}
												<span class="flag-badge flag-badge--sm">
													<span class="material-symbols-outlined">flag</span>
													{commentFlags}
												</span>
											{/if}
											<span class="comment-item__author">{comment.profiles?.display_name ?? '—'}</span>
											<span class="subject-row__dot">·</span>
											<span class="comment-item__time">{formatDate(comment.created_at)}</span>
										</div>
										<p class="comment-item__body">{comment.body}</p>
										<form method="POST" action="?/deleteComment" use:enhance
											onsubmit={(e) => { if (!confirm('Delete this comment?')) e.preventDefault(); }}>
											<input type="hidden" name="comment_id" value={comment.id} />
											<button type="submit" class="btn-delete btn-delete--sm">
												<span class="material-symbols-outlined">delete</span>
												Delete
											</button>
										</form>
									</div>
								{/each}
							</div>
						{:else if expandedSubject === subject.id}
							<p class="no-comments">No comments on this subject.</p>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	{/if}

	<!-- Flags tab -->
	{#if activeTab === 'flags'}
		<div class="content-list">
			{#if data.flags.length === 0}
				<p class="empty">No flags — all clear!</p>
			{:else}
				{#each data.flags as flag (flag.id)}
					<div class="flag-row">
						<div class="flag-row__info">
							<span class="flag-row__type">{flag.target_type}</span>
							<span class="flag-row__id" title={flag.target_id}>{flag.target_id.slice(0, 8)}…</span>
							<span class="subject-row__dot">·</span>
							<span class="flag-row__reporter">
								by {flag.profiles?.display_name ?? '—'}
							</span>
							<span class="subject-row__dot">·</span>
							<span class="flag-row__time">{formatDate(flag.created_at)}</span>
						</div>
						<div class="flag-row__actions">
							{#if flag.target_type === 'subject'}
								<a
									href={resolve(`/community/${flag.target_id}`)}
									class="btn-view"
									target="_blank"
									aria-label="View subject"
								>
									<span class="material-symbols-outlined">open_in_new</span>
								</a>
							{/if}
							<form method="POST" action="?/dismissFlag" use:enhance>
								<input type="hidden" name="flag_id" value={flag.id} />
								<button type="submit" class="btn-dismiss">
									<span class="material-symbols-outlined">check</span>
									Dismiss
								</button>
							</form>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	.admin-comm {
		max-width: 900px;
		margin: 0 auto;
		padding: var(--section-padding);
	}

	.admin-comm__header { margin-bottom: 1.5rem; }

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		text-decoration: none;
		margin-bottom: 0.75rem;
		transition: color var(--transition-fast);
	}

	.back-link:hover { color: var(--color-primary); text-decoration: none; }
	.back-link .material-symbols-outlined { font-size: 18px; }

	.admin-comm__header h1 { margin: 0 0 0.25rem; }

	.admin-comm__stats {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin: 0;
	}

	/* ---- TABS ---- */
	.tabs {
		display: flex;
		gap: 0.25rem;
		border-bottom: var(--border-width) solid var(--color-border-light);
		margin-bottom: 1.5rem;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.6rem 1rem;
		background: none;
		border: none;
		font: inherit;
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--color-text-muted);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		transition: color var(--transition-fast), border-color var(--transition-fast);
	}

	.tab .material-symbols-outlined { font-size: 18px; }
	.tab:hover { color: var(--color-text); }
	.tab--active { color: var(--color-primary); border-bottom-color: var(--color-primary); }

	.tab__badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.2rem;
		height: 1.2rem;
		padding: 0 0.2rem;
		background: #f97316;
		color: white;
		border-radius: var(--border-radius-full);
		font-size: 0.7rem;
		font-weight: 700;
	}

	/* ---- CONTENT LIST ---- */
	.content-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.empty {
		text-align: center;
		color: var(--color-text-muted);
		padding: 3rem 0;
	}

	/* ---- SUBJECT ROW ---- */
	.subject-row {
		background: var(--color-surface);
		border: var(--border-width) solid var(--color-border-light);
		border-radius: var(--border-radius-lg);
		padding: 1rem 1.25rem;
	}

	.subject-row--flagged {
		border-color: #fdba74;
		background: rgba(251,146,60,0.03);
	}

	.subject-row__top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.4rem;
	}

	.subject-row__info {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-wrap: wrap;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		min-width: 0;
	}

	.subject-row__author { font-weight: 600; color: var(--color-text); }
	.subject-row__dot { color: var(--color-border); }

	.subject-row__comments {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
	}

	.subject-row__comments .material-symbols-outlined { font-size: 13px; }

	.subject-row__actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.subject-row__title {
		margin: 0 0 0.3rem;
		font-size: var(--font-size-base);
		font-weight: 700;
	}

	.subject-row__body {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* ---- COMMENT LIST ---- */
	.comment-list {
		margin-top: 0.75rem;
		border-top: var(--border-width) solid var(--color-border-light);
		padding-top: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.comment-item {
		padding: 0.75rem;
		background: var(--color-bg);
		border-radius: var(--border-radius);
		border: var(--border-width) solid var(--color-border-light);
	}

	.comment-item--flagged {
		border-color: #fdba74;
	}

	.comment-item__meta {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin-bottom: 0.3rem;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.comment-item__author { font-weight: 600; color: var(--color-text); }

	.comment-item__body {
		margin: 0 0 0.5rem;
		font-size: var(--font-size-sm);
		line-height: 1.5;
	}

	.no-comments {
		margin-top: 0.75rem;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		font-style: italic;
	}

	/* ---- FLAG BADGE ---- */
	.flag-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		padding: 0.1rem 0.4rem;
		background: rgba(249,115,22,0.1);
		color: #f97316;
		border-radius: var(--border-radius-full);
		font-size: var(--font-size-xs);
		font-weight: 700;
	}

	.flag-badge .material-symbols-outlined { font-size: 13px; }
	.flag-badge--sm { font-size: 0.65rem; }

	/* ---- FLAG ROW ---- */
	.flag-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.875rem 1.25rem;
		background: var(--color-surface);
		border: var(--border-width) solid #fdba74;
		border-radius: var(--border-radius-lg);
	}

	.flag-row__info {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-wrap: wrap;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		min-width: 0;
	}

	.flag-row__type {
		font-weight: 700;
		text-transform: capitalize;
		color: #f97316;
	}

	.flag-row__id {
		font-family: monospace;
		font-size: 0.7rem;
		background: var(--color-bg-muted);
		padding: 0.1rem 0.35rem;
		border-radius: var(--border-radius);
	}

	.flag-row__reporter { font-weight: 600; color: var(--color-text); }

	.flag-row__actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	/* ---- BUTTONS ---- */
	.btn-expand,
	.btn-view {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		background: none;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
		color: var(--color-text-muted);
		cursor: pointer;
		text-decoration: none;
		transition: background var(--transition-fast), color var(--transition-fast);
	}

	.btn-expand:hover,
	.btn-view:hover {
		background: var(--color-bg-muted);
		color: var(--color-text);
		text-decoration: none;
	}

	.btn-expand .material-symbols-outlined,
	.btn-view .material-symbols-outlined { font-size: 18px; }

	.btn-delete {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		width: 2rem;
		height: 2rem;
		background: none;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
		color: #ef4444;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.btn-delete:hover { background: rgba(239,68,68,0.08); }
	.btn-delete .material-symbols-outlined { font-size: 18px; }

	.btn-delete--sm {
		width: auto;
		height: auto;
		padding: 0.2rem 0.6rem;
		font-size: var(--font-size-xs);
	}

	.btn-delete--sm .material-symbols-outlined { font-size: 14px; }

	.btn-dismiss {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.3rem 0.75rem;
		background: #22c55e;
		color: white;
		border: none;
		border-radius: var(--border-radius-full);
		font: inherit;
		font-size: var(--font-size-xs);
		font-weight: 600;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.btn-dismiss:hover { background: #16a34a; }
	.btn-dismiss .material-symbols-outlined { font-size: 15px; }
</style>
