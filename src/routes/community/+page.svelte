<script lang="ts">
	import { resolve } from '$app/paths';
	import { fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import TourTagBadge from '$lib/tours/TourTagBadge.svelte';

	let { data, form } = $props();

	// Available community tags
	const COMMUNITY_TAGS = [
		'general', 'training', 'gear', 'destinations', 'beginners',
		'racing', 'safety', 'weather', 'events', 'tips'
	];

	let filterOpen = $state(false);
	let activeTags = $state<string[]>([]);
	let showForm = $state(false);
	let submitting = $state(false);

	// Collect tags from existing subjects
	const allTags = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const s of data.subjects) {
			for (const tag of (s.tags ?? [])) {
				counts.set(tag, (counts.get(tag) ?? 0) + 1);
			}
		}
		// Merge with defaults
		for (const tag of COMMUNITY_TAGS) {
			if (!counts.has(tag)) counts.set(tag, 0);
		}
		return [...counts.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([tag]) => tag);
	});

	const filteredSubjects = $derived.by(() => {
		if (activeTags.length === 0) return data.subjects;
		return data.subjects.filter(s =>
			activeTags.some(tag => (s.tags ?? []).includes(tag))
		);
	});

	function toggleTag(tag: string) {
		activeTags = activeTags.includes(tag)
			? activeTags.filter(t => t !== tag)
			: [...activeTags, tag];
	}

	function clearFilters() {
		activeTags = [];
	}

	function formatDate(dateStr: string) {
		const d = new Date(dateStr);
		const now = new Date();
		const diff = now.getTime() - d.getTime();
		const mins = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);
		if (mins < 60) return `${mins}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
	}

	// Selected tags for new subject form
	let formSelectedTags = $state<string[]>([]);
	function toggleFormTag(tag: string) {
		formSelectedTags = formSelectedTags.includes(tag)
			? formSelectedTags.filter(t => t !== tag)
			: [...formSelectedTags, tag];
	}

	// Reset form state after successful submit
	$effect(() => {
		if (form?.success) {
			showForm = false;
			formSelectedTags = [];
		}
	});
</script>

<svelte:head>
	<title>Community — SUP Tours</title>
</svelte:head>

<div class="community-page">
	<!-- Filter bar -->
	<div class="comm-bar">
		<div class="comm-bar__main">
			<span class="comm-bar__count">
				{filteredSubjects.length} subject{filteredSubjects.length !== 1 ? 's' : ''}
				{#if activeTags.length > 0}
					<span class="comm-bar__filtered">(filtered)</span>
				{/if}
			</span>

			<div class="comm-bar__actions">
				{#if filterOpen}
					<div class="comm-bar__tags-inline" in:fly={{ x: 30, duration: 200 }} out:fly={{ x: 10, duration: 150 }}>
						{#each allTags as tag (tag)}
							<button
								class="comm-bar__tag"
								class:comm-bar__tag--active={activeTags.includes(tag)}
								onclick={() => toggleTag(tag)}
							>
								{tag}
							</button>
						{/each}
					</div>
				{/if}

				<button
					class="comm-bar__filter-btn"
					class:comm-bar__filter-btn--active={filterOpen || activeTags.length > 0}
					onclick={() => filterOpen = !filterOpen}
					aria-label="Filter subjects"
				>
					<span class="material-symbols-outlined">tune</span>
					{#if activeTags.length === 0}
						Filter
					{:else}
						<span class="comm-bar__filter-count">{activeTags.length}</span>
						<button
							class="comm-bar__filter-clear"
							onclick={(e) => { e.stopPropagation(); clearFilters(); }}
							aria-label="Clear filters"
						>
							<span class="material-symbols-outlined">close</span>
						</button>
					{/if}
				</button>

				<button class="btn-new" onclick={() => showForm = !showForm}>
					<span class="material-symbols-outlined">add</span>
					New subject
				</button>
			</div>
		</div>
	</div>

	<!-- New subject form -->
	{#if showForm}
		<div class="new-subject" in:fly={{ y: -10, duration: 200 }}>
			<h2 class="new-subject__heading">Start a new subject</h2>
			<form
				method="POST"
				action="?/createSubject"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						submitting = false;
						await update();
					};
				}}
			>
				<input type="hidden" name="tags" value={formSelectedTags.join(',')} />

				<div class="form-field">
					<label for="title">Title</label>
					<input
						id="title"
						name="title"
						type="text"
						placeholder="What's your subject about?"
						maxlength="200"
						required
					/>
				</div>

				<div class="form-field">
					<label for="body">Description</label>
					<textarea
						id="body"
						name="body"
						placeholder="Share your thoughts, question, or story…"
						rows="4"
						required
					></textarea>
				</div>

				<div class="form-field">
					<label>Tags <span class="form-field__hint">(optional)</span></label>
					<div class="tag-picker">
						{#each COMMUNITY_TAGS as tag (tag)}
							<button
								type="button"
								class="tag-picker__tag"
								class:tag-picker__tag--active={formSelectedTags.includes(tag)}
								onclick={() => toggleFormTag(tag)}
							>
								{tag}
							</button>
						{/each}
					</div>
				</div>

				{#if form?.error}
					<p class="form-error">{form.error}</p>
				{/if}

				<div class="form-actions">
					<button type="button" class="btn-cancel" onclick={() => showForm = false}>Cancel</button>
					<button type="submit" class="btn-submit" disabled={submitting}>
						{submitting ? 'Posting…' : 'Post subject'}
					</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Subject list -->
	<div class="subjects-list">
		{#if filteredSubjects.length === 0}
			<div class="empty-state">
				<span class="material-symbols-outlined">forum</span>
				<p>{activeTags.length > 0 ? 'No subjects match your filter.' : 'No subjects yet — be the first to start a conversation!'}</p>
				{#if activeTags.length === 0}
					<button class="btn-new btn-new--center" onclick={() => showForm = true}>
						<span class="material-symbols-outlined">add</span>
						Start a subject
					</button>
				{/if}
			</div>
		{:else}
			{#each filteredSubjects as subject (subject.id)}
				<a href={resolve(`/community/${subject.id}`)} class="subject-card">
					<div class="subject-card__top">
						<div class="subject-card__meta">
							<span class="subject-card__author">
								{subject.profiles?.display_name ?? 'Paddler'}
							</span>
							<span class="subject-card__dot">·</span>
							<span class="subject-card__time">{formatDate(subject.created_at)}</span>
						</div>
						<h3 class="subject-card__title">{subject.title}</h3>
						<p class="subject-card__body">{subject.body}</p>
					</div>
					<div class="subject-card__footer">
						<div class="subject-card__tags">
							{#each (subject.tags ?? []) as tag (tag)}
								<TourTagBadge {tag} />
							{/each}
						</div>
						<span class="subject-card__comments">
							<span class="material-symbols-outlined">comment</span>
							{subject.subject_comments?.[0]?.count ?? 0}
						</span>
					</div>
				</a>
			{/each}
		{/if}
	</div>
</div>

<style>
	.community-page {
		width: 100%;
		max-width: 800px;
		margin: 0 auto;
		min-height: 100vh;
	}

	/* ---- FILTER BAR ---- */
	.comm-bar {
		position: sticky;
		top: 0;
		z-index: 100;
		background: var(--color-surface);
		border-bottom: var(--border-width) solid var(--color-border-light);
		padding: 0.6rem 1rem;
	}

	.comm-bar__main {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.comm-bar__count {
		display: none;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		font-weight: 500;
		flex-shrink: 0;
	}

	@media (min-width: 768px) {
		.comm-bar__count { display: block; }
	}

	.comm-bar__filtered { color: var(--color-primary); }

	.comm-bar__actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
		flex: 1;
	}

	.comm-bar__filter-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.75rem;
		border-radius: var(--border-radius-full);
		background: var(--color-surface);
		border: var(--border-width) solid var(--color-border);
		font: inherit;
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--color-text);
		cursor: pointer;
		transition: background var(--transition-fast), border-color var(--transition-fast);
		flex-shrink: 0;
	}

	.comm-bar__filter-btn .material-symbols-outlined { font-size: 18px; }
	.comm-bar__filter-btn:hover { background: var(--color-bg-muted); }
	.comm-bar__filter-btn--active { border-color: var(--color-primary); color: var(--color-primary); }

	.comm-bar__filter-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.2rem;
		border-radius: var(--border-radius-full);
		background: var(--color-primary);
		color: white;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.comm-bar__filter-clear {
		display: flex;
		align-items: center;
		padding: 0.1rem;
		margin-left: -0.2rem;
		margin-right: -0.3rem;
		background: none;
		border: none;
		color: var(--color-primary);
		cursor: pointer;
		border-radius: var(--border-radius-full);
	}

	.comm-bar__filter-clear:hover { background: var(--color-primary-light); }
	.comm-bar__filter-clear .material-symbols-outlined { font-size: 16px; }

	.comm-bar__tags-inline {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		overflow-x: auto;
		padding-bottom: 2px;
		scrollbar-width: none;
		-ms-overflow-style: none;
		flex: 1;
		min-width: 0;
	}

	.comm-bar__tags-inline::-webkit-scrollbar { display: none; }

	.comm-bar__tag {
		padding: 0.3rem 0.75rem;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius-full);
		background: var(--color-surface);
		font: inherit;
		font-size: var(--font-size-xs);
		font-weight: 600;
		text-transform: capitalize;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: all var(--transition-fast);
		white-space: nowrap;
	}

	.comm-bar__tag:hover { border-color: var(--color-primary); color: var(--color-primary); }
	.comm-bar__tag--active { background: var(--color-primary); border-color: var(--color-primary); color: white; }

	/* ---- NEW SUBJECT BUTTON ---- */
	.btn-new {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.4rem 0.9rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--border-radius-full);
		font: inherit;
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
		transition: background var(--transition-fast);
		white-space: nowrap;
		flex-shrink: 0;
		text-decoration: none;
	}

	.btn-new:hover { background: var(--color-primary-dark); text-decoration: none; }
	.btn-new .material-symbols-outlined { font-size: 18px; }
	.btn-new--center { margin-top: 1rem; }

	/* ---- NEW SUBJECT FORM ---- */
	.new-subject {
		margin: 1rem 1rem 0;
		padding: 1.5rem;
		background: var(--color-surface);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius-lg);
	}

	.new-subject__heading {
		margin: 0 0 1.25rem;
		font-size: var(--font-size-lg);
		font-weight: 700;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}

	.form-field label {
		font-size: var(--font-size-sm);
		font-weight: 600;
	}

	.form-field__hint {
		font-weight: 400;
		color: var(--color-text-muted);
	}

	.form-field input,
	.form-field textarea {
		padding: 0.6rem 0.75rem;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
		font: inherit;
		font-size: var(--font-size-sm);
		background: var(--color-bg);
		transition: border-color var(--transition-fast);
		resize: vertical;
	}

	.form-field input:focus,
	.form-field textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.tag-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.tag-picker__tag {
		padding: 0.25rem 0.65rem;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius-full);
		background: var(--color-surface);
		font: inherit;
		font-size: var(--font-size-xs);
		font-weight: 600;
		text-transform: capitalize;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.tag-picker__tag:hover { border-color: var(--color-primary); color: var(--color-primary); }
	.tag-picker__tag--active { background: var(--color-primary); border-color: var(--color-primary); color: white; }

	.form-error {
		color: #ef4444;
		font-size: var(--font-size-sm);
		margin: 0 0 0.75rem;
	}

	.form-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		margin-top: 0.5rem;
	}

	.btn-cancel {
		padding: 0.5rem 1rem;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius-full);
		background: none;
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
		color: var(--color-text-muted);
	}

	.btn-cancel:hover { background: var(--color-bg-muted); }

	.btn-submit {
		padding: 0.5rem 1.25rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--border-radius-full);
		font: inherit;
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.btn-submit:hover:not(:disabled) { background: var(--color-primary-dark); }
	.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

	/* ---- SUBJECT LIST ---- */
	.subjects-list {
		padding: 1rem 1rem 3rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 1rem;
		color: var(--color-text-muted);
	}

	.empty-state .material-symbols-outlined {
		font-size: 48px;
		color: var(--color-primary);
		margin-bottom: 0.75rem;
	}

	.subject-card {
		display: block;
		padding: 1.25rem;
		background: var(--color-surface);
		border: var(--border-width) solid var(--color-border-light);
		border-radius: var(--border-radius-lg);
		text-decoration: none;
		color: inherit;
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
	}

	.subject-card:hover {
		border-color: var(--color-primary);
		box-shadow: var(--shadow-sm);
		text-decoration: none;
	}

	.subject-card__top {
		margin-bottom: 0.875rem;
	}

	.subject-card__meta {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin-bottom: 0.4rem;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.subject-card__author { font-weight: 600; color: var(--color-text); }
	.subject-card__dot { color: var(--color-border); }

	.subject-card__title {
		margin: 0 0 0.4rem;
		font-size: var(--font-size-base);
		font-weight: 700;
		line-height: 1.35;
	}

	.subject-card__body {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.subject-card__footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.subject-card__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.subject-card__comments {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.subject-card__comments .material-symbols-outlined { font-size: 16px; }

	@media (min-width: 768px) {
		.comm-bar { padding: 0.75rem 2rem; }
		.subjects-list { padding: 1.25rem 2rem 3rem; }
		.new-subject { margin: 1rem 2rem 0; }
	}
</style>
