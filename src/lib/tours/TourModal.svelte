<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Tour } from './dateGrouping';
	import TourTagBadge from './TourTagBadge.svelte';

	let {
		tour,
		user,
		onclose
	}: {
		tour: Tour;
		user: { id: string } | null;
		onclose: () => void;
	} = $props();

	const formattedStartDate = $derived(() => {
		const d = new Date(tour.start_date + 'T00:00:00');
		const str = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
		if (tour.start_time) {
			return `${str} at ${tour.start_time.slice(0, 5)}`;
		}
		return str;
	});

	const formattedEndDate = $derived(() => {
		if (!tour.end_date) return null;
		const d = new Date(tour.end_date + 'T00:00:00');
		return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	const placeholderImages = [
		'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
		'https://images.unsplash.com/photo-1502680390548-bdbac40a2aa4?auto=format&fit=crop&w=1200&q=80',
		'https://images.unsplash.com/photo-1526188717906-ab4a2f949f78?auto=format&fit=crop&w=1200&q=80'
	];

	const imageUrl = $derived(
		tour.image_url || placeholderImages[Math.abs(tour.title.length) % placeholderImages.length]
	);
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={onclose} onkeydown={() => {}}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
		<!-- Header image -->
		<div class="modal__hero">
			<img src={imageUrl} alt={tour.title} class="modal__hero-img" />
			<div class="modal__hero-overlay"></div>
			<button class="modal__close" onclick={onclose} aria-label="Close">
				<span class="material-symbols-outlined">close</span>
			</button>
			<div class="modal__hero-content">
				<span class="modal__source-badge" class:modal__source-badge--official={tour.source === 'web'}>
					{tour.source === 'web' ? 'Official Event' : 'Community'}
				</span>
				<h2 class="modal__title">{tour.title}</h2>
			</div>
		</div>

		<!-- Body -->
		<div class="modal__body">
			<!-- Date & Location -->
			<div class="modal__section">
				<div class="modal__info-row">
					<span class="material-symbols-outlined modal__info-icon">calendar_month</span>
					<div>
						<strong>{formattedStartDate()}</strong>
						{#if formattedEndDate()}
							<span class="modal__date-end"> — {formattedEndDate()}</span>
						{/if}
					</div>
				</div>

				{#if tour.locality}
					<div class="modal__info-row">
						<span class="material-symbols-outlined modal__info-icon">location_on</span>
						<span>{tour.locality}</span>
					</div>
				{/if}

				{#if tour.parking_info}
					<div class="modal__info-row">
						<span class="material-symbols-outlined modal__info-icon">local_parking</span>
						<span>{tour.parking_info}</span>
					</div>
				{/if}
			</div>

			<!-- Description -->
			{#if tour.description}
				<div class="modal__section">
					<h3 class="modal__section-title">About this tour</h3>
					<p class="modal__description">{tour.description}</p>
				</div>
			{/if}

			<!-- Tags -->
			{#if tour.tags.length > 0}
				<div class="modal__section">
					<div class="modal__tags">
						{#each tour.tags as tag (tag)}
							<TourTagBadge {tag} />
						{/each}
					</div>
				</div>
			{/if}

			<!-- Details grid -->
			<div class="modal__section modal__details-grid">
				{#if tour.max_participants}
					<div class="modal__detail">
						<span class="material-symbols-outlined">group</span>
						<div>
							<strong>{tour.participant_count} / {tour.max_participants}</strong>
							<span>Participants</span>
						</div>
					</div>
				{/if}

				<div class="modal__detail">
					<span class="material-symbols-outlined">child_care</span>
					<div>
						<strong>{tour.age_min}–{tour.age_max} years</strong>
						<span>Age range</span>
					</div>
				</div>
			</div>

			<!-- Security notes -->
			{#if tour.security_notes}
				<div class="modal__section modal__security">
					<h3 class="modal__section-title">
						<span class="material-symbols-outlined" style="color: var(--color-warning)">shield</span>
						Safety & Security
					</h3>
					<p>{tour.security_notes}</p>
				</div>
			{/if}

			<!-- Contact -->
			{#if tour.responsible_person || tour.contact_info}
				<div class="modal__section">
					<h3 class="modal__section-title">Contact</h3>
					{#if tour.responsible_person}
						<p><strong>Responsible:</strong> {tour.responsible_person}</p>
					{/if}
					{#if tour.contact_info}
						<p><strong>Contact:</strong> {tour.contact_info}</p>
					{/if}
				</div>
			{/if}

			<!-- External link -->
			{#if tour.external_url}
				<div class="modal__section">
					<a href={tour.external_url} target="_blank" rel="noopener noreferrer" class="modal__external-link">
						<span class="material-symbols-outlined">open_in_new</span>
						View original event page
					</a>
				</div>
			{/if}
		</div>

		<!-- Join action -->
		<div class="modal__action">
			{#if user}
				<form method="POST" action="?/{tour.has_joined ? 'leave' : 'join'}" use:enhance>
					<input type="hidden" name="tour_id" value={tour.id} />
					<button type="submit" class="modal__join-btn" class:modal__join-btn--joined={tour.has_joined}>
						{#if tour.has_joined}
							<span class="material-symbols-outlined">check_circle</span>
							You're in! (Leave)
						{:else}
							<span class="material-symbols-outlined">add_circle</span>
							Join this tour!
						{/if}
					</button>
				</form>
			{:else}
				<a href="/login?next=/tours" class="modal__join-btn">
					Log in to join
				</a>
			{/if}
		</div>
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 200;
		display: flex;
		justify-content: center;
		align-items: flex-end;
		padding: 0;
	}

	.modal {
		background: var(--color-surface);
		width: 100%;
		max-width: 32rem;
		max-height: 95vh;
		border-radius: var(--border-radius-xl) var(--border-radius-xl) 0 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	@media (min-width: 768px) {
		.modal-backdrop {
			align-items: center;
			padding: 2rem;
		}
		.modal {
			border-radius: var(--border-radius-xl);
			max-height: 90vh;
		}
	}

	/* Hero */
	.modal__hero {
		position: relative;
		height: 14rem;
		overflow: hidden;
		flex-shrink: 0;
	}

	.modal__hero-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.modal__hero-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%);
	}

	.modal__close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: var(--border-radius-full);
		background: rgba(0, 0, 0, 0.4);
		border: none;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		backdrop-filter: blur(4px);
		z-index: 3;
	}

	.modal__close:hover {
		background: rgba(0, 0, 0, 0.6);
	}

	.modal__hero-content {
		position: absolute;
		bottom: 1rem;
		left: 1rem;
		right: 1rem;
		z-index: 2;
	}

	.modal__source-badge {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		border-radius: var(--border-radius-full);
		background: var(--color-secondary);
		color: var(--color-text);
		font-size: var(--font-size-xs);
		font-weight: 700;
		margin-bottom: 0.5rem;
	}

	.modal__source-badge--official {
		background: rgba(255,255,255,0.9);
		color: var(--color-primary);
	}

	.modal__title {
		margin: 0;
		font-size: var(--font-size-2xl);
		font-weight: 700;
		color: white;
		line-height: var(--line-height-tight);
	}

	/* Body */
	.modal__body {
		flex: 1;
		padding: 1.25rem;
		overflow-y: auto;
	}

	.modal__section {
		margin-bottom: 1.25rem;
	}

	.modal__section:last-child {
		margin-bottom: 0;
	}

	.modal__section-title {
		margin: 0 0 0.5rem;
		font-size: var(--font-size-base);
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.modal__info-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.6rem;
		font-size: var(--font-size-sm);
	}

	.modal__info-icon {
		font-size: 20px;
		color: var(--color-primary);
		flex-shrink: 0;
	}

	.modal__date-end {
		color: var(--color-text-muted);
	}

	.modal__description {
		margin: 0;
		color: var(--color-text-muted);
		line-height: var(--line-height-relaxed);
		white-space: pre-line;
	}

	.modal__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	/* Details grid */
	.modal__details-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.modal__detail {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--color-bg-muted);
		border-radius: var(--border-radius);
	}

	.modal__detail .material-symbols-outlined {
		font-size: 22px;
		color: var(--color-primary);
	}

	.modal__detail strong {
		display: block;
		font-size: var(--font-size-sm);
	}

	.modal__detail span:last-child {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	/* Security */
	.modal__security {
		padding: 1rem;
		background: rgba(245, 158, 11, 0.08);
		border-radius: var(--border-radius);
		border-left: 3px solid var(--color-warning);
	}

	.modal__security p {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.modal__external-link {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--color-primary);
		font-weight: 500;
		text-decoration: none;
	}

	.modal__external-link:hover {
		text-decoration: underline;
	}

	/* Action bar */
	.modal__action {
		padding: 1rem 1.25rem;
		border-top: var(--border-width) solid var(--color-border-light);
		background: var(--color-surface);
		flex-shrink: 0;
	}

	.modal__action form { margin: 0; }

	.modal__join-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.85rem;
		border: none;
		border-radius: var(--border-radius-full);
		background: var(--color-primary);
		color: white;
		font: inherit;
		font-size: var(--font-size-base);
		font-weight: 700;
		cursor: pointer;
		box-shadow: var(--shadow-primary);
		transition: background var(--transition-fast), transform var(--transition-fast);
		text-decoration: none;
	}

	.modal__join-btn:hover {
		background: var(--color-primary-dark);
		text-decoration: none;
	}

	.modal__join-btn:active {
		transform: scale(0.97);
	}

	.modal__join-btn--joined {
		background: var(--color-bg-muted);
		color: var(--color-text-muted);
		box-shadow: none;
	}

	.modal__join-btn--joined:hover {
		background: var(--color-error);
		color: white;
	}
</style>
