<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import TourTagBadge from '$lib/tours/TourTagBadge.svelte';

	let { data, form } = $props();

	let submitting = $state(false);
	let commentBody = $state('');
	let flagConfirm = $state<string | null>(null); // id of item being flagged

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('en-GB', {
			day: 'numeric', month: 'short', year: 'numeric',
			hour: '2-digit', minute: '2-digit'
		});
	}

	function isFlagged(type: 'subject' | 'comment', id: string) {
		return data.myFlags.has(`${type}:${id}`);
	}

	// Navigate back after subject delete
	$effect(() => {
		if (form?.deleteSubjectSuccess) {
			goto(resolve('/community'));
		}
	});

	// Clear textarea after successful comment
	$effect(() => {
		if (form?.commentSuccess) {
			commentBody = '';
		}
	});
</script>

<svelte:head>
	<title>{data.subject.title} — Community — SUP Tours</title>
</svelte:head>

<div class="subject-page">
	<!-- Back -->
	<a href={resolve('/community')} class="back-link">
		<span class="material-symbols-outlined">arrow_back</span>
		Community
	</a>

	<!-- Subject -->
	<article class="subject">
		<header class="subject__header">
			<div class="subject__meta">
				<span class="subject__author">{data.subject.profiles?.display_name ?? 'Paddler'}</span>
				<span class="subject__dot">·</span>
				<span class="subject__time">{formatDate(data.subject.created_at)}</span>
			</div>
			<h1 class="subject__title">{data.subject.title}</h1>
			{#if (data.subject.tags ?? []).length > 0}
				<div class="subject__tags">
					{#each data.subject.tags as tag (tag)}
						<TourTagBadge {tag} />
					{/each}
				</div>
			{/if}
		</header>

		<div class="subject__body">
			{data.subject.body}
		</div>

		<footer class="subject__footer">
			<div class="subject__footer-actions">
				<!-- Flag subject -->
				{#if data.subject.author_id !== data.userId}
					{#if isFlagged('subject', data.subject.id)}
						<span class="flag-label flag-label--done">
							<span class="material-symbols-outlined">flag</span>
							Flagged
						</span>
					{:else if flagConfirm === 'subject'}
						<form method="POST" action="?/flag" use:enhance>
							<input type="hidden" name="target_type" value="subject" />
							<input type="hidden" name="target_id" value={data.subject.id} />
							<span class="flag-confirm-text">Flag this subject?</span>
							<button type="submit" class="btn-flag-confirm">Yes, flag</button>
							<button type="button" class="btn-flag-cancel" onclick={() => flagConfirm = null}>Cancel</button>
						</form>
					{:else}
						<button class="btn-flag" onclick={() => flagConfirm = 'subject'}>
							<span class="material-symbols-outlined">flag</span>
							Flag
						</button>
					{/if}
				{/if}

				<!-- Delete subject (own or admin) -->
				{#if data.subject.author_id === data.userId}
					<form method="POST" action="?/deleteSubject" use:enhance
						onsubmit={(e) => { if (!confirm('Delete this subject and all its comments?')) e.preventDefault(); }}>
						<button type="submit" class="btn-delete">
							<span class="material-symbols-outlined">delete</span>
							Delete subject
						</button>
					</form>
				{/if}
			</div>
		</footer>
	</article>

	<!-- Comments -->
	<section class="comments">
		<h2 class="comments__heading">
			{data.comments.length} comment{data.comments.length !== 1 ? 's' : ''}
		</h2>

		{#each data.comments as comment (comment.id)}
			<div class="comment">
				<div class="comment__meta">
					<span class="comment__author">{comment.profiles?.display_name ?? 'Paddler'}</span>
					<span class="comment__dot">·</span>
					<span class="comment__time">{formatDate(comment.created_at)}</span>
				</div>
				<p class="comment__body">{comment.body}</p>
				<div class="comment__actions">
					<!-- Flag comment -->
					{#if comment.author_id !== data.userId}
						{#if isFlagged('comment', comment.id)}
							<span class="flag-label flag-label--done">
								<span class="material-symbols-outlined">flag</span>
								Flagged
							</span>
						{:else if flagConfirm === comment.id}
							<form method="POST" action="?/flag" use:enhance>
								<input type="hidden" name="target_type" value="comment" />
								<input type="hidden" name="target_id" value={comment.id} />
								<span class="flag-confirm-text">Flag this comment?</span>
								<button type="submit" class="btn-flag-confirm">Yes, flag</button>
								<button type="button" class="btn-flag-cancel" onclick={() => flagConfirm = null}>Cancel</button>
							</form>
						{:else}
							<button class="btn-flag" onclick={() => flagConfirm = comment.id}>
								<span class="material-symbols-outlined">flag</span>
								Flag
							</button>
						{/if}
					{/if}

					<!-- Delete comment (own) -->
					{#if comment.author_id === data.userId}
						<form method="POST" action="?/deleteComment" use:enhance
							onsubmit={(e) => { if (!confirm('Delete this comment?')) e.preventDefault(); }}>
							<input type="hidden" name="comment_id" value={comment.id} />
							<button type="submit" class="btn-delete btn-delete--sm">
								<span class="material-symbols-outlined">delete</span>
							</button>
						</form>
					{/if}
				</div>
			</div>
		{/each}

		<!-- Add comment -->
		<div class="comment-form">
			<h3 class="comment-form__heading">Add a comment</h3>
			<form
				method="POST"
				action="?/addComment"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						submitting = false;
						await update();
					};
				}}
			>
				<textarea
					name="body"
					bind:value={commentBody}
					placeholder="Share your thoughts…"
					rows="3"
					maxlength="2000"
					required
				></textarea>
				{#if form?.commentError}
					<p class="form-error">{form.commentError}</p>
				{/if}
				<div class="comment-form__actions">
					<span class="comment-form__chars">{commentBody.length}/2000</span>
					<button type="submit" class="btn-submit" disabled={submitting || commentBody.trim().length === 0}>
						{submitting ? 'Posting…' : 'Post comment'}
					</button>
				</div>
			</form>
		</div>
	</section>
</div>

<style>
	.subject-page {
		width: 100%;
		max-width: 720px;
		margin: 0 auto;
		padding: 1.5rem 1rem 4rem;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--color-text-muted);
		text-decoration: none;
		margin-bottom: 1.5rem;
		transition: color var(--transition-fast);
	}

	.back-link:hover { color: var(--color-primary); text-decoration: none; }
	.back-link .material-symbols-outlined { font-size: 18px; }

	/* ---- SUBJECT ---- */
	.subject {
		background: var(--color-surface);
		border: var(--border-width) solid var(--color-border-light);
		border-radius: var(--border-radius-lg);
		padding: 1.5rem;
		margin-bottom: 2rem;
	}

	.subject__header { margin-bottom: 1rem; }

	.subject__meta {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin-bottom: 0.5rem;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.subject__author { font-weight: 600; color: var(--color-text); }
	.subject__dot { color: var(--color-border); }

	.subject__title {
		margin: 0 0 0.75rem;
		font-size: var(--font-size-xl);
		font-weight: 800;
		line-height: 1.3;
	}

	.subject__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.subject__body {
		font-size: var(--font-size-base);
		line-height: 1.7;
		color: var(--color-text);
		white-space: pre-wrap;
		border-top: var(--border-width) solid var(--color-border-light);
		padding-top: 1rem;
		margin-bottom: 1rem;
	}

	.subject__footer { border-top: var(--border-width) solid var(--color-border-light); padding-top: 0.75rem; }

	.subject__footer-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	/* ---- COMMENTS ---- */
	.comments {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.comments__heading {
		margin: 0 0 1rem;
		font-size: var(--font-size-base);
		font-weight: 700;
		color: var(--color-text-muted);
	}

	.comment {
		padding: 1rem 0;
		border-bottom: var(--border-width) solid var(--color-border-light);
	}

	.comment:first-of-type { border-top: var(--border-width) solid var(--color-border-light); }

	.comment__meta {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin-bottom: 0.4rem;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.comment__author { font-weight: 600; color: var(--color-text); }
	.comment__dot { color: var(--color-border); }

	.comment__body {
		margin: 0 0 0.5rem;
		font-size: var(--font-size-sm);
		line-height: 1.6;
		white-space: pre-wrap;
	}

	.comment__actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* ---- FLAG / DELETE ---- */
	.btn-flag {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		background: none;
		border: none;
		font: inherit;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: var(--border-radius);
		transition: color var(--transition-fast), background var(--transition-fast);
	}

	.btn-flag:hover { color: #f97316; background: rgba(249,115,22,0.08); }
	.btn-flag .material-symbols-outlined { font-size: 15px; }

	.flag-label {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		padding: 0.25rem 0.5rem;
	}

	.flag-label--done { color: #f97316; }
	.flag-label .material-symbols-outlined { font-size: 15px; }

	.flag-confirm-text {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		margin-right: 0.25rem;
	}

	.btn-flag-confirm {
		padding: 0.2rem 0.6rem;
		background: #f97316;
		color: white;
		border: none;
		border-radius: var(--border-radius-full);
		font: inherit;
		font-size: var(--font-size-xs);
		font-weight: 600;
		cursor: pointer;
	}

	.btn-flag-cancel {
		padding: 0.2rem 0.6rem;
		background: none;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius-full);
		font: inherit;
		font-size: var(--font-size-xs);
		cursor: pointer;
		color: var(--color-text-muted);
	}

	.btn-delete {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: none;
		border: none;
		font: inherit;
		font-size: var(--font-size-xs);
		color: #ef4444;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: var(--border-radius);
		transition: background var(--transition-fast);
	}

	.btn-delete:hover { background: rgba(239,68,68,0.08); }
	.btn-delete .material-symbols-outlined { font-size: 15px; }
	.btn-delete--sm .material-symbols-outlined { font-size: 16px; }

	/* ---- COMMENT FORM ---- */
	.comment-form {
		margin-top: 2rem;
		padding: 1.25rem;
		background: var(--color-surface);
		border: var(--border-width) solid var(--color-border-light);
		border-radius: var(--border-radius-lg);
	}

	.comment-form__heading {
		margin: 0 0 0.75rem;
		font-size: var(--font-size-base);
		font-weight: 700;
	}

	.comment-form textarea {
		width: 100%;
		padding: 0.6rem 0.75rem;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
		font: inherit;
		font-size: var(--font-size-sm);
		background: var(--color-bg);
		resize: vertical;
		box-sizing: border-box;
		transition: border-color var(--transition-fast);
	}

	.comment-form textarea:focus { outline: none; border-color: var(--color-primary); }

	.form-error {
		color: #ef4444;
		font-size: var(--font-size-xs);
		margin: 0.4rem 0 0;
	}

	.comment-form__actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 0.5rem;
	}

	.comment-form__chars {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

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

	@media (min-width: 768px) {
		.subject-page { padding: 2rem 2rem 4rem; }
	}
</style>
