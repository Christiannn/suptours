<script lang="ts">
	import type { Tour } from './dateGrouping';
	import TourTagBadge from './TourTagBadge.svelte';
	import { resolve } from '$app/paths';

	let { tour, onclick, user }: { tour: Tour; onclick: () => void; user: any } = $props();

	const isCreator = $derived(user && tour.creator_id === user.id);

	const hasSeatCap = $derived(
		tour.max_participants != null && Number(tour.max_participants) > 0,
	);
	const hasJoined = $derived(tour.participant_count > 0);

	const dateOverlay = $derived.by(() => {
		const d = new Date(tour.start_date + 'T00:00:00');
		const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
		return {
			datePart,
			dayName,
			startTime: tour.start_time ? tour.start_time.slice(0, 5) : null
		};
	});

	const sourceBadge = $derived(tour.source === 'web' ? 'Official Event' : 'Community');

	const placeholderImages = [
		'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
		'https://images.unsplash.com/photo-1502680390548-bdbac40a2aa4?auto=format&fit=crop&w=800&q=80',
		'https://images.unsplash.com/photo-1526188717906-ab4a2f949f78?auto=format&fit=crop&w=800&q=80'
	];

	const imageUrl = $derived(
		tour.image_url || placeholderImages[Math.abs(tour.title.length) % placeholderImages.length]
	);
</script>

<button type="button" class="tour-card" onclick={onclick}>
	<div class="tour-card__image-wrap">
		<div class="tour-card__badge" class:tour-card__badge--official={tour.source === 'web'}>
			{sourceBadge}
		</div>
		<img
			src={imageUrl}
			alt={tour.title}
			class="tour-card__image"
			loading="lazy"
		/>
		<div class="tour-card__image-overlay"></div>
		<div class="tour-card__date-overlay">
			<span class="material-symbols-outlined tour-card__date-icon">calendar_month</span>
			<div class="tour-card__date-text">
				<span class="tour-card__date-part">{dateOverlay.datePart}</span>
				<span class="tour-card__date-sep" aria-hidden="true">·</span>
				<span class="tour-card__date-day">{dateOverlay.dayName}</span>
				{#if dateOverlay.startTime}
					<span class="tour-card__date-sep tour-card__date-sep--before-time" aria-hidden="true">·</span>
					<span class="tour-card__date-start">starting {dateOverlay.startTime}</span>
				{/if}
			</div>
		</div>
	</div>

	<div class="tour-card__body">
		<h3 class="tour-card__title">{tour.title}</h3>

		<div class="tour-card__meta">
			<span class="material-symbols-outlined tour-card__location-icon">location_on</span>
			<span class="tour-card__locality">{tour.locality ?? 'Location TBD'}</span>
		</div>

		{#if tour.tags.length > 0}
			<div class="tour-card__tags">
				{#each tour.tags.slice(0, 3) as tag (tag)}
					<TourTagBadge {tag} />
				{/each}
				{#if tour.tags.length > 3}
					<span class="tour-card__more-tags">+{tour.tags.length - 3}</span>
				{/if}
			</div>
		{/if}

		<div class="tour-card__footer">
			<div class="tour-card__footer-left">
				{#if hasSeatCap || hasJoined}
					<div class="tour-card__capacity">
						{#if hasSeatCap}
							<span class="tour-card__seats tour-card__seats--desktop">Seats: {tour.max_participants}</span>
							<span class="tour-card__seats tour-card__seats--mobile">Seats {tour.max_participants}</span>
						{/if}
						{#if hasSeatCap && hasJoined}
							<span class="tour-card__cap-sep" aria-hidden="true">/</span>
						{/if}
						{#if hasJoined}
							<span class="tour-card__joined">
								<span class="material-symbols-outlined tour-card__joined-icon" aria-hidden="true">group</span>
								<span>{tour.participant_count} joined</span>
							</span>
						{/if}
					</div>
				{/if}
				{#if isCreator}
					<a 
						href={resolve(`/tours/${tour.id}/edit`)} 
						class="tour-card__edit-btn"
						onclick={(e) => e.stopPropagation()}
					>
						<span class="material-symbols-outlined">edit</span>
						Edit
					</a>
				{/if}
			</div>
			<span class="tour-card__join-hint" class:tour-card__join-hint--joined={tour.has_joined}>
				{tour.has_joined ? 'Going ✓' : "I'm going"}
			</span>
		</div>
	</div>
</button>

<style>
	.tour-card {
		display: block;
		width: 100%;
		background: var(--color-surface);
		border-radius: var(--border-radius-lg);
		box-shadow: var(--shadow-card);
		overflow: hidden;
		border: none;
		cursor: pointer;
		text-align: left;
		padding: 0;
		font: inherit;
		color: inherit;
		transition: box-shadow var(--transition-normal), transform var(--transition-normal);
	}

	.tour-card:hover {
		box-shadow: var(--shadow-soft);
		transform: translateY(-2px);
	}

	.tour-card:active {
		transform: scale(0.985);
	}

	/* ---- Image area ---- */
	.tour-card__image-wrap {
		position: relative;
		height: 9rem;
		overflow: hidden;
	}

	.tour-card__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.3s ease;
	}

	.tour-card:hover .tour-card__image {
		transform: scale(1.04);
	}

	.tour-card__image-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 55%);
	}

	/* ---- Badge ---- */
	.tour-card__badge {
		position: absolute;
		top: 0.6rem;
		left: 0.6rem;
		z-index: 2;
		padding: 0.15rem 0.6rem;
		border-radius: var(--border-radius-full);
		background: var(--color-secondary);
		color: var(--color-text);
		font-size: 0.6875rem;
		font-weight: 700;
	}

	.tour-card__badge--official {
		background: rgba(255, 255, 255, 0.92);
		color: var(--color-primary);
	}

	/* ---- Date overlay ---- */
	.tour-card__date-overlay {
		position: absolute;
		bottom: 0.6rem;
		left: 0.6rem;
		right: 0.6rem;
		display: flex;
		align-items: flex-start;
		gap: 0.25rem;
		color: white;
		font-size: 0.75rem;
		font-weight: 500;
		z-index: 2;
	}

	@media (min-width: 768px) {
		.tour-card__date-overlay {
			align-items: center;
		}
	}

	.tour-card__date-icon {
		font-size: 15px;
		margin-top: 0.05rem;
		flex-shrink: 0;
	}

	@media (min-width: 768px) {
		.tour-card__date-icon {
			margin-top: 0;
		}
	}

	.tour-card__date-text {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		column-gap: 0.35rem;
		row-gap: 0.1rem;
		line-height: 1.25;
		text-align: left;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
		min-width: 0;
	}

	@media (min-width: 768px) {
		.tour-card__date-text {
			flex-wrap: nowrap;
			column-gap: 0.35rem;
		}
	}

	.tour-card__date-sep {
		opacity: 0.85;
		user-select: none;
	}

	@media (max-width: 767px) {
		.tour-card__date-sep--before-time {
			display: none;
		}

		.tour-card__date-start {
			flex: 1 0 100%;
		}
	}

	.tour-card__date-start {
		font-weight: 600;
		letter-spacing: 0.02em;
		opacity: 0.95;
		white-space: nowrap;
	}

	/* ---- Body ---- */
	.tour-card__body {
		padding: 0.75rem 0.85rem;
	}

	.tour-card__title {
		margin: 0 0 0.35rem;
		font-size: var(--font-size-base);
		font-weight: 700;
		line-height: var(--line-height-tight);
		color: var(--color-text);
	}

	.tour-card__meta {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin-bottom: 0.5rem;
	}

	.tour-card__location-icon {
		font-size: 16px;
		color: var(--color-primary);
		flex-shrink: 0;
	}

	.tour-card__locality {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 14rem;
	}

	/* ---- Tags ---- */
	.tour-card__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-bottom: 0.6rem;
	}

	.tour-card__more-tags {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		align-self: center;
	}

	/* ---- Footer ---- */
	.tour-card__footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 0.6rem;
		border-top: var(--border-width) solid var(--color-border-light);
	}

	.tour-card__footer-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	/* Seats + joined (desktop: one row with / ; mobile: stacked, no icon on joined) */
	.tour-card__capacity {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.2rem;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		min-width: 0;
	}

	.tour-card__seats--desktop {
		display: none;
	}

	.tour-card__seats--mobile {
		display: inline;
	}

	.tour-card__cap-sep {
		display: none;
	}

	.tour-card__joined {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.tour-card__joined-icon {
		font-size: 16px;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	@media (min-width: 768px) {
		.tour-card__capacity {
			flex-direction: row;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.35rem;
		}

		.tour-card__seats--desktop {
			display: inline;
		}

		.tour-card__seats--mobile {
			display: none;
		}

		.tour-card__cap-sep {
			display: inline;
			opacity: 0.65;
			user-select: none;
		}

		.tour-card__joined-icon {
			display: inline-block;
		}
	}

	@media (max-width: 767px) {
		.tour-card__joined-icon {
			display: none;
		}
	}

	.tour-card__edit-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--color-primary);
		text-decoration: none;
		padding: 0.2rem 0.5rem;
		border-radius: var(--border-radius-sm);
		background: var(--color-primary-light);
		transition: background var(--transition-fast);
	}

	.tour-card__edit-btn:hover {
		background: var(--color-primary);
		color: white;
		text-decoration: none;
	}

	.tour-card__edit-btn .material-symbols-outlined {
		font-size: 14px;
	}

	.tour-card__join-hint {
		padding: 0.3rem 0.85rem;
		font-size: var(--font-size-sm);
		font-weight: 600;
		border-radius: var(--border-radius-full);
		border: 1px solid var(--color-primary-border);
		background: rgba(var(--color-primary-rgb), 0.1);
		color: var(--color-primary);
		transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
	}

	.tour-card:hover .tour-card__join-hint:not(.tour-card__join-hint--joined) {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary-border);
	}

	.tour-card__join-hint--joined {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary-border);
		box-shadow: var(--shadow-primary);
	}

	/* ---- Responsive ---- */
	@media (min-width: 768px) {
		.tour-card__image-wrap {
			height: 11rem;
		}

		.tour-card__body {
			padding: 1rem 1.1rem;
		}

		.tour-card__title {
			font-size: var(--font-size-lg);
			margin-bottom: 0.4rem;
		}
	}
</style>
