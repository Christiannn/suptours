<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import TourTagBadge from '$lib/tours/TourTagBadge.svelte';
	import { buildTourDetailPageJsonLd, safeJsonLdStringify } from '$lib/tours/schemaOrg';

	let { data } = $props();

	let joining = $state(false);

	const tour = $derived(data.tour);

	const formattedStartDate = $derived(() => {
		const d = new Date(tour.start_date + 'T00:00:00');
		const str = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
		return tour.start_time ? `${str} at ${tour.start_time.slice(0, 5)}` : str;
	});

	const placeholderImages = [
		'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
		'https://images.unsplash.com/photo-1502680390548-bdbac40a2aa4?auto=format&fit=crop&w=1200&q=80'
	];

	const imageUrl = $derived(
		tour.image_url || placeholderImages[Math.abs(tour.title.length) % placeholderImages.length]
	);

	const tourJsonLdString = $derived.by(() =>
		safeJsonLdStringify(buildTourDetailPageJsonLd(page.url.origin, tour)),
	);
</script>

<svelte:head>
	<title>{tour.title} — SUP Tours</title>
	<meta name="description" content={tour.description ?? `${tour.title} at ${tour.locality ?? 'TBD'}`} />
	{@html `<script type="application/ld+json">${tourJsonLdString}</script>`}
</svelte:head>

<div class="tour-detail">
	<!-- Hero -->
	<div class="tour-detail__hero">
		<img src={imageUrl} alt={tour.title} class="tour-detail__hero-img" />
		<div class="tour-detail__hero-overlay"></div>
		<div class="tour-detail__hero-content">
			<span class="tour-detail__badge" class:tour-detail__badge--official={tour.source === 'web'}>
				{tour.source === 'web' ? 'Official Event' : 'Community'}
			</span>
			<h1 class="tour-detail__title">{tour.title}</h1>
		</div>
	</div>

	<div class="tour-detail__body">
		<!-- Quick info -->
		<div class="tour-detail__info-section">
			<div class="tour-detail__info-row">
				<span class="material-symbols-outlined tour-detail__icon">calendar_month</span>
				<strong>{formattedStartDate()}</strong>
			</div>
			{#if tour.locality}
				<div class="tour-detail__info-row">
					<span class="material-symbols-outlined tour-detail__icon">location_on</span>
					<span>{tour.locality}</span>
				</div>
			{/if}
			{#if tour.parking_info}
				<div class="tour-detail__info-row">
					<span class="material-symbols-outlined tour-detail__icon">local_parking</span>
					<span>{tour.parking_info}</span>
				</div>
			{/if}
		</div>

		{#if tour.description}
			<div class="tour-detail__section">
				<h2>About this tour</h2>
				<p class="tour-detail__description">{tour.description}</p>
			</div>
		{/if}

		{#if tour.tags.length > 0}
			<div class="tour-detail__tags">
				{#each tour.tags as tag (tag)}
					<TourTagBadge {tag} />
				{/each}
			</div>
		{/if}

		<!-- Stats -->
		<div class="tour-detail__stats">
			<div class="tour-detail__stat">
				<span class="material-symbols-outlined">group</span>
				<strong>{tour.participant_count}{tour.max_participants ? ` / ${tour.max_participants}` : ''}</strong>
				<span>Participants</span>
			</div>
			<div class="tour-detail__stat">
				<span class="material-symbols-outlined">child_care</span>
				<strong>{tour.age_min ?? '—'}–{tour.age_max ?? '—'}</strong>
				<span>Age range</span>
			</div>
			<div class="tour-detail__stat">
				<span class="material-symbols-outlined">visibility</span>
				<strong>{tour.view_count}</strong>
				<span>Views</span>
			</div>
		</div>

		{#if tour.security_notes}
			<div class="tour-detail__security">
				<h3>
					<span class="material-symbols-outlined" style="color: var(--color-warning)">shield</span>
					Safety & Security
				</h3>
				<p>{tour.security_notes}</p>
			</div>
		{/if}

		{#if tour.responsible_person || tour.contact_info}
			<div class="tour-detail__section">
				<h3>Contact</h3>
				{#if tour.responsible_person}<p><strong>Responsible:</strong> {tour.responsible_person}</p>{/if}
				{#if tour.contact_info}<p><strong>Contact:</strong> {tour.contact_info}</p>{/if}
			</div>
		{/if}

		<!-- Participants -->
		{#if data.participantProfiles.length > 0}
			<div class="tour-detail__section">
				<h3>Participants</h3>
				<div class="tour-detail__participants">
					{#each data.participantProfiles as profile (profile.id)}
						<div class="tour-detail__participant">
							{#if profile.avatar_url}
								<img src={profile.avatar_url} alt={profile.display_name ?? 'User'} class="tour-detail__avatar" />
							{:else}
								<div class="tour-detail__avatar tour-detail__avatar--placeholder">
									<span class="material-symbols-outlined">person</span>
								</div>
							{/if}
							<span>{profile.display_name ?? 'Anonymous'}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Join action -->
		<div class="tour-detail__action">
			{#if data.user}
				<form method="POST" action="?/{tour.has_joined ? 'leave' : 'join'}" use:enhance={() => {
					joining = true;
					return async ({ result, update }) => {
						joining = false;
						if (result.type === 'failure') {
							console.error('[TourDetail] Join/Leave error:', result.data?.message, result);
						}
						await update();
					};
				}}>
					<button type="submit" class="tour-detail__join-btn" class:tour-detail__join-btn--joined={tour.has_joined} disabled={joining}>
						{#if joining}
							<span class="tour-detail__spinner"></span>
							{tour.has_joined ? 'Leaving...' : 'Joining...'}
						{:else if tour.has_joined}
							<span class="material-symbols-outlined">check_circle</span>
							You're in! (Leave)
						{:else}
							<span class="material-symbols-outlined">add_circle</span>
							Join this tour!
						{/if}
					</button>
				</form>
			{:else}
				<a href="/login?next=/tours/{tour.id}" class="tour-detail__join-btn">
					Log in to join
				</a>
			{/if}
		</div>
	</div>
</div>

<style>
	.tour-detail {
		max-width: 40rem;
		margin: 0 auto;
	}

	.tour-detail__hero {
		position: relative;
		height: 16rem;
		overflow: hidden;
	}

	.tour-detail__hero-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.tour-detail__hero-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 60%);
	}

	.tour-detail__hero-content {
		position: absolute;
		bottom: 1.25rem;
		left: 1.25rem;
		right: 1.25rem;
		z-index: 2;
	}

	.tour-detail__badge {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		border-radius: var(--border-radius-full);
		background: var(--color-secondary);
		color: var(--color-text);
		font-size: var(--font-size-xs);
		font-weight: 700;
		margin-bottom: 0.5rem;
	}

	.tour-detail__badge--official {
		background: rgba(255,255,255,0.9);
		color: var(--color-primary);
	}

	.tour-detail__title {
		margin: 0;
		font-size: var(--font-size-2xl);
		color: white;
		line-height: var(--line-height-tight);
	}

	.tour-detail__body {
		padding: 1.5rem 1.25rem;
	}

	.tour-detail__info-section {
		margin-bottom: 1.5rem;
	}

	.tour-detail__info-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.5rem;
		font-size: var(--font-size-sm);
	}

	.tour-detail__icon {
		font-size: 20px;
		color: var(--color-primary);
	}

	.tour-detail__section {
		margin-bottom: 1.5rem;
	}

	.tour-detail__section h2,
	.tour-detail__section h3 {
		margin: 0 0 0.5rem;
		font-size: var(--font-size-base);
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.tour-detail__description {
		margin: 0;
		color: var(--color-text-muted);
		line-height: var(--line-height-relaxed);
		white-space: pre-line;
	}

	.tour-detail__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 1.5rem;
	}

	.tour-detail__stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.tour-detail__stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		padding: 0.75rem;
		background: var(--color-bg-muted);
		border-radius: var(--border-radius);
		text-align: center;
	}

	.tour-detail__stat .material-symbols-outlined {
		font-size: 24px;
		color: var(--color-primary);
	}

	.tour-detail__stat strong {
		font-size: var(--font-size-sm);
	}

	.tour-detail__stat span:last-child {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.tour-detail__security {
		padding: 1rem;
		background: rgba(245, 158, 11, 0.08);
		border-radius: var(--border-radius);
		border-left: 3px solid var(--color-warning);
		margin-bottom: 1.5rem;
	}

	.tour-detail__security h3 {
		margin: 0 0 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: var(--font-size-base);
	}

	.tour-detail__security p {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.tour-detail__participants {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.tour-detail__participant {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--font-size-sm);
	}

	.tour-detail__avatar {
		width: 2rem;
		height: 2rem;
		border-radius: var(--border-radius-full);
		object-fit: cover;
	}

	.tour-detail__avatar--placeholder {
		background: var(--color-bg-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-muted);
	}

	.tour-detail__avatar--placeholder .material-symbols-outlined {
		font-size: 18px;
	}

	.tour-detail__action {
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: var(--border-width) solid var(--color-border);
	}

	.tour-detail__action form { margin: 0; }

	.tour-detail__spinner {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		border: 2px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: detail-spin 0.7s linear infinite;
		flex-shrink: 0;
	}

	@keyframes detail-spin {
		to { transform: rotate(360deg); }
	}

	.tour-detail__join-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.85rem;
		border: 1px solid var(--color-primary-border);
		border-radius: var(--border-radius-full);
		background: var(--color-primary);
		color: white;
		font: inherit;
		font-size: var(--font-size-base);
		font-weight: 700;
		cursor: pointer;
		box-shadow: var(--shadow-primary);
		text-decoration: none;
		transition: background var(--transition-fast);
	}

	.tour-detail__join-btn:hover {
		background: var(--color-primary-dark);
		border-color: var(--color-primary-border);
		text-decoration: none;
	}

	.tour-detail__join-btn--joined {
		background: var(--color-bg-muted);
		color: var(--color-text-muted);
		border-color: var(--color-border);
		box-shadow: none;
	}

	.tour-detail__join-btn--joined:hover {
		background: var(--color-error);
		color: white;
		border-color: var(--color-error);
	}
</style>
