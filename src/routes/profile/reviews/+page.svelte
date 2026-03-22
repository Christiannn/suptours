<script lang="ts">
	import { resolve } from '$app/paths';
	import TourReviewPrompt from '$lib/tours/TourReviewPrompt.svelte';

	let { data, form } = $props();

	function fmtWhen(iso: string | null) {
		if (!iso) return '';
		return new Date(iso).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="reviews-page">
	<h1>My reviews</h1>
	<p class="reviews-page__intro">
		Finish reviews for past trips, and see what you’ve already shared.
	</p>

	{#if form?.reviewError}
		<p class="message error" role="alert">{form.reviewError}</p>
	{/if}

	{#if data.pendingTourReviews.length > 0}
		<section class="review-queue" aria-labelledby="review-queue-heading">
			<div class="review-queue__head">
				<h2 id="review-queue-heading">Waiting for your feedback</h2>
				<p class="review-queue__lede">
					These tours are finished — add a review or skip if you prefer.
				</p>
			</div>
			{#each data.pendingTourReviews as tour (tour.id)}
				<TourReviewPrompt {tour} />
			{/each}
		</section>
	{:else}
		<p class="reviews-page__empty-pending">No trips waiting for a review right now.</p>
	{/if}

	<section class="history" aria-labelledby="history-heading">
		<h2 id="history-heading">Your activity</h2>
		{#if data.myReviews.length === 0}
			<p class="reviews-page__empty">You haven’t submitted or skipped any reviews yet.</p>
		{:else}
			<ul class="history-list">
				{#each data.myReviews as item (item.id)}
					<li class="history-card">
						<div class="history-card__main">
							<h3 class="history-card__title">
								<a href={resolve('/tours/[id]', { id: item.tourId })}>{item.title}</a>
							</h3>
							<p class="history-card__meta">{fmtWhen(item.created_at)}</p>
							{#if item.kind === 'declined'}
								<p class="history-card__note">You chose not to review this trip.</p>
							{:else if item.hasRatings}
								<div class="history-card__stars" aria-label="Average rating {item.rating_display} of 5">
									{#each Array(5) as _, i}
										<span
											class="material-symbols-outlined history-star"
											class:history-star--filled={i < item.rating_display}
										>
											star
										</span>
									{/each}
								</div>
								<p class="history-card__visibility">{item.visibility_label}</p>
								{#if item.comment}
									<p class="history-card__comment">“{item.comment}”</p>
								{/if}
							{:else}
								<p class="history-card__note">Review on file.</p>
							{/if}
						</div>
						{#if item.kind === 'submitted' && item.image_url}
							<div class="history-card__thumb">
								<img src={item.image_url} alt="" loading="lazy" />
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.reviews-page {
		max-width: 44rem;
		padding: var(--section-padding);
	}

	.reviews-page__intro {
		margin: 0 0 1.5rem;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	.reviews-page h1 {
		margin: 0 0 0.35rem;
		font-size: var(--font-size-2xl, 1.5rem);
		font-weight: 700;
	}

	.message.error {
		color: var(--color-error);
		margin-bottom: 1rem;
	}

	.review-queue {
		margin-bottom: 2.5rem;
		padding: 1.25rem 1.35rem;
		border-radius: var(--border-radius-lg);
		background: var(--color-bg-muted);
		border: var(--border-width) solid var(--color-border);
	}

	.review-queue__head {
		margin-bottom: 1rem;
	}

	.review-queue h2 {
		margin: 0 0 0.35rem;
		font-size: var(--font-size-xl);
		font-weight: 700;
	}

	.review-queue__lede {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	.reviews-page__empty-pending {
		margin: 0 0 2rem;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.history h2 {
		margin: 0 0 1rem;
		font-size: var(--font-size-lg);
		font-weight: 700;
	}

	.reviews-page__empty {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.history-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.history-card {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		padding: 1rem 1.1rem;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius-lg);
		background: var(--color-surface);
	}

	.history-card__main {
		flex: 1;
		min-width: 0;
	}

	.history-card__title {
		margin: 0 0 0.2rem;
		font-size: var(--font-size-base);
		font-weight: 700;
	}

	.history-card__title a {
		color: var(--color-text);
		text-decoration: none;
	}

	.history-card__title a:hover {
		color: var(--color-primary);
	}

	.history-card__meta {
		margin: 0 0 0.35rem;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.history-card__note {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		font-style: italic;
	}

	.history-card__stars {
		display: flex;
		gap: 0.1rem;
		margin: 0.35rem 0 0.25rem;
	}

	.history-star {
		font-size: 18px;
		color: var(--color-border);
	}

	.history-star--filled {
		color: #f59e0b;
		font-variation-settings: 'FILL' 1;
	}

	.history-card__visibility {
		margin: 0 0 0.35rem;
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--color-primary);
	}

	.history-card__comment {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		line-height: 1.45;
	}

	.history-card__thumb {
		flex-shrink: 0;
		width: 5.5rem;
		height: 5.5rem;
		border-radius: var(--border-radius);
		overflow: hidden;
		background: var(--color-bg-muted);
	}

	.history-card__thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
</style>
