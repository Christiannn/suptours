<script lang="ts">
	import { resolve } from '$app/paths';
	import { fly } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import TourTimeline from '$lib/tours/TourTimeline.svelte';
	import TourModal from '$lib/tours/TourModal.svelte';
	import { groupToursByDate, type Tour } from '$lib/tours/dateGrouping';
	import { getTourShowSlug } from '$lib/tours/tourShowSlug';

	let { data } = $props();

	let filterOpen = $state(false);
	let activeTags = $state<string[]>([]);
	let visibleCount = $state(5);
	let loadMoreTrigger = $state<HTMLElement | null>(null);

	const invitations = [
		"Ready to lead? Create your own tour!",
		"Got a favorite spot? Share it with a new tour!",
		"Invite others to your next paddle adventure!",
		"Be the spark! Start a community tour today.",
		"Know a hidden gem? Lead a tour there!",
		"Want company on the water? Create a tour!"
	];

	// Source of truth is now the URL. selectedTour is derived from it.
	const selectedTour = $derived.by(() => {
		const showParam = page.url.searchParams.get('show');
		if (!showParam) return null;
		return data.tours.find((t) => getTourShowSlug(t) === showParam) ?? null;
	});

	// Get a stable set of random indices for invitations based on tour count
	const getInvitation = (index: number) => invitations[index % invitations.length];

	// Collect all unique tags from tours, sorted by frequency
	const allTags = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const tour of data.tours) {
			for (const tag of tour.tags) {
				counts.set(tag, (counts.get(tag) ?? 0) + 1);
			}
		}
		return [...counts.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([tag]) => tag);
	});

	// Filter tours by selected tags
	const filteredTours = $derived.by(() => {
		if (activeTags.length === 0) return data.tours;
		return data.tours.filter((tour: Tour) =>
			activeTags.some(tag => tour.tags.includes(tag))
		);
	});

	// Slice tours for pagination
	const visibleTours = $derived(filteredTours.slice(0, visibleCount));
	const hasMore = $derived(visibleCount < filteredTours.length);

	const groups = $derived(groupToursByDate(visibleTours));

	function toggleTag(tag: string) {
		activeTags = activeTags.includes(tag) 
			? activeTags.filter(t => t !== tag) 
			: [...activeTags, tag];
		visibleCount = 5; // Reset pagination on filter change
	}

	function clearFilters() {
		activeTags = [];
		visibleCount = 5;
	}

	function openTour(tour: Tour) {
		const url = new URL(window.location.href);
		url.searchParams.set('show', getTourShowSlug(tour));
		goto(url.toString(), { replaceState: false, noScroll: true, keepFocus: true });
	}

	function closeTour() {
		const url = new URL(window.location.href);
		url.searchParams.delete('show');
		goto(url.toString(), { replaceState: false, noScroll: true, keepFocus: true });
	}

	function loadMore() {
		if (hasMore) {
			visibleCount += 5;
		}
	}

	onMount(() => {
		const observer = new IntersectionObserver((entries) => {
			if (entries[0].isIntersecting) {
				loadMore();
			}
		}, { threshold: 0.1 });

		if (loadMoreTrigger) observer.observe(loadMoreTrigger);

		return () => observer.disconnect();
	});
</script>

<svelte:head>
	<title>SUP Tours — Upcoming Paddle Adventures</title>
</svelte:head>

<div class="tours-page">
	<!-- Filter bar -->
	<div class="tours-bar">
		<div class="tours-bar__main">
			<span class="tours-bar__count">
				{filteredTours.length} tour{filteredTours.length !== 1 ? 's' : ''}
				{#if activeTags.length > 0}
					<span class="tours-bar__filtered">(filtered)</span>
				{/if}
			</span>
			
			<div class="tours-bar__actions">
				{#if filterOpen}
					<div class="tours-bar__tags-inline" in:fly={{ x: 30, duration: 200 }} out:fly={{ x: 10, duration: 150 }}>
						{#each allTags as tag (tag)}
							<button
								class="tours-bar__tag"
								class:tours-bar__tag--active={activeTags.includes(tag)}
								onclick={() => toggleTag(tag)}
							>
								{tag}
							</button>
						{/each}
					</div>
				{/if}

				<div class="tours-bar__filter-group">
					<button
						type="button"
						class="tours-bar__filter-btn"
						class:tours-bar__filter-btn--active={filterOpen || activeTags.length > 0}
						onclick={() => filterOpen = !filterOpen}
						aria-label="Filter tours"
					>
						<span class="material-symbols-outlined">tune</span>
						{#if activeTags.length === 0}
							Filter
						{:else}
							<span class="tours-bar__filter-count">{activeTags.length}</span>
						{/if}
					</button>
					{#if activeTags.length > 0}
						<button
							type="button"
							class="tours-bar__filter-clear"
							onclick={clearFilters}
							aria-label="Clear filters"
						>
							<span class="material-symbols-outlined">close</span>
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Timeline with embedded invitations -->
	<div class="tours-content">
		<TourTimeline {groups} onselect={openTour} user={data.user} />
		
		{#if visibleTours.length > 0}
			<div class="tours-invitation">
				<a href={resolve('/tours/new')} class="tours-invitation__card">
					<span class="material-symbols-outlined">add_circle</span>
					{getInvitation(Math.floor(visibleTours.length / 5))}
				</a>
			</div>
		{/if}

		<!-- Load more trigger -->
		{#if hasMore}
			<div bind:this={loadMoreTrigger} class="tours-loader">
				<div class="tours-loader__spinner"></div>
			</div>
		{/if}
	</div>

	<!-- FAB for creating tour (desktop) -->
	{#if data.user}
		<a href={resolve('/tours/new')} class="tours-fab" aria-label="Create new tour">
			<span class="material-symbols-outlined">add</span>
		</a>
	{/if}
</div>

<!-- Modal -->
{#if selectedTour}
	<TourModal tour={selectedTour} user={data.user} onclose={closeTour} />
{/if}

<style>
	.tours-page {
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		min-height: 100vh;
		position: relative;
	}

	/* ---- FILTER BAR ---- */
	.tours-bar {
		position: sticky;
		top: 0;
		z-index: 100;
		background: var(--color-surface);
		border-bottom: var(--border-width) solid var(--color-border-light);
		padding: 0.6rem 1rem;
	}

	.tours-bar__main {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.tours-bar__count {
		display: none;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		font-weight: 500;
		flex-shrink: 0;
	}

	@media (min-width: 768px) {
		.tours-bar__count {
			display: block;
		}
	}

	.tours-bar__filtered {
		color: var(--color-primary);
	}

	.tours-bar__actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
		min-width: 0;
		flex: 1;
	}

	.tours-bar__filter-group {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		flex-shrink: 0;
	}

	.tours-bar__filter-btn {
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

	.tours-bar__filter-btn .material-symbols-outlined {
		font-size: 18px;
	}

	.tours-bar__filter-btn:hover {
		background: var(--color-bg-muted);
	}

	.tours-bar__filter-btn--active {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.tours-bar__filter-count {
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

	.tours-bar__filter-clear {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.1rem;
		margin-left: -0.2rem;
		margin-right: -0.3rem;
		background: none;
		border: none;
		color: var(--color-primary);
		cursor: pointer;
		border-radius: var(--border-radius-full);
	}

	.tours-bar__filter-clear:hover {
		background: var(--color-primary-light);
	}

	.tours-bar__filter-clear .material-symbols-outlined {
		font-size: 16px;
	}

	/* ---- TAGS INLINE ---- */
	.tours-bar__tags-inline {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		overflow-x: auto;
		padding-bottom: 2px;
		scrollbar-width: none; /* Firefox */
		-ms-overflow-style: none; /* IE/Edge */
		flex: 1;
		min-width: 0;
	}

	.tours-bar__tags-inline::-webkit-scrollbar {
		display: none; /* Chrome/Safari */
	}

	.tours-bar__tag {
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

	.tours-bar__tag:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.tours-bar__tag--active {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	.tours-bar__tag--active:hover {
		color: white;
	}

	/* ---- CONTENT ---- */
	.tours-content {
		padding: 1.25rem 1rem 2rem;
	}

	/* ---- INVITATIONS ---- */
	.tours-invitation {
		margin: 1.5rem 0 2rem;
		padding-left: 2rem;
	}

	.tours-invitation__card {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1.25rem;
		background: var(--color-primary-light);
		border: 2px dashed var(--color-primary);
		border-radius: var(--border-radius-lg);
		color: var(--color-primary);
		font-size: var(--font-size-base);
		font-weight: 700;
		text-decoration: none;
		transition: transform var(--transition-fast), background var(--transition-fast);
		text-align: center;
	}

	.tours-invitation__card:hover {
		background: #d1f2f9;
		transform: translateY(-2px);
		text-decoration: none;
	}

	.tours-invitation__card .material-symbols-outlined {
		font-size: 28px;
	}

	/* ---- LOADER ---- */
	.tours-loader {
		display: flex;
		justify-content: center;
		padding: 2rem 0;
	}

	.tours-loader__spinner {
		width: 1.5rem;
		height: 1.5rem;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* ---- FAB (desktop) ---- */
	.tours-fab {
		display: none;
		position: fixed;
		bottom: 2rem;
		right: 2rem;
		width: 3.5rem;
		height: 3.5rem;
		border-radius: var(--border-radius-full);
		background: var(--color-primary);
		color: white;
		align-items: center;
		justify-content: center;
		box-shadow: var(--shadow-primary);
		z-index: 40;
		text-decoration: none;
		transition: background var(--transition-fast), transform var(--transition-fast);
	}

	.tours-fab:hover {
		background: var(--color-primary-dark);
		transform: scale(1.05);
		text-decoration: none;
	}

	.tours-fab .material-symbols-outlined {
		font-size: 28px;
	}

	/* ---- RESPONSIVE ---- */
	@media (min-width: 768px) {
		.tours-bar {
			padding: 0.75rem 2rem;
		}

		.tours-content {
			padding: 2rem 2rem 3rem;
		}

		.tours-fab {
			display: flex;
		}

		.tours-invitation {
			padding-left: 2.5rem;
			margin: 2.5rem 0 3rem;
		}
	}

	@media (min-width: 1232px) {
		.tours-bar {
			border-radius: 0 0 var(--border-radius) var(--border-radius);
		}
	}
</style>

