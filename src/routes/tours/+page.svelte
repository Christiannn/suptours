<script lang="ts">
	import { resolve } from '$app/paths';
	import TourTimeline from '$lib/tours/TourTimeline.svelte';
	import TourModal from '$lib/tours/TourModal.svelte';
	import { groupToursByDate, type Tour } from '$lib/tours/dateGrouping';

	let { data } = $props();

	let selectedTour = $state<Tour | null>(null);
	let filterOpen = $state(false);
	let activeTags = $state<string[]>([]);

	// Collect all unique tags from tours, sorted by frequency
	const allTags = $derived(() => {
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

	// Filter tours by selected tags (a tour matches if it has ANY of the active tags)
	const filteredTours = $derived(() => {
		if (activeTags.length === 0) return data.tours;
		return data.tours.filter((tour: Tour) =>
			activeTags.some(tag => tour.tags.includes(tag))
		);
	});

	const groups = $derived(groupToursByDate(filteredTours()));

	function toggleTag(tag: string) {
		if (activeTags.includes(tag)) {
			activeTags = activeTags.filter(t => t !== tag);
		} else {
			activeTags = [...activeTags, tag];
		}
	}

	function clearFilters() {
		activeTags = [];
	}

	function openTour(tour: Tour) {
		selectedTour = tour;
	}

	function closeTour() {
		selectedTour = null;
	}
</script>

<svelte:head>
	<title>SUP Tours — Upcoming Paddle Adventures</title>
</svelte:head>

<div class="tours-page">
	<!-- Filter bar -->
	<div class="tours-bar">
		<span class="tours-bar__count">
			{filteredTours().length} tour{filteredTours().length !== 1 ? 's' : ''}
			{#if activeTags.length > 0}
				<span class="tours-bar__filtered">(filtered)</span>
			{/if}
		</span>
		<button
			class="tours-bar__filter-btn"
			class:tours-bar__filter-btn--active={filterOpen || activeTags.length > 0}
			onclick={() => filterOpen = !filterOpen}
			aria-label="Filter tours"
		>
			<span class="material-symbols-outlined">tune</span>
			Filter
			{#if activeTags.length > 0}
				<span class="tours-bar__filter-count">{activeTags.length}</span>
			{/if}
		</button>
	</div>

	<!-- Tag filter drawer -->
	{#if filterOpen}
		<div class="tours-filter">
			<div class="tours-filter__header">
				<span class="tours-filter__label">Filter by type</span>
				{#if activeTags.length > 0}
					<button class="tours-filter__clear" onclick={clearFilters}>
						Clear all
					</button>
				{/if}
			</div>
			<div class="tours-filter__tags">
				{#each allTags() as tag (tag)}
					<button
						class="tours-filter__tag"
						class:tours-filter__tag--active={activeTags.includes(tag)}
						onclick={() => toggleTag(tag)}
					>
						{tag}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Timeline -->
	<div class="tours-content">
		<TourTimeline {groups} onselect={openTour} />
	</div>

	<!-- Sticky slide-out CTA (mobile) -->
	{#if data.user}
		<div class="tours-create-hint">
			<a href={resolve('/tours/new')} class="tours-create-hint__link">
				<span class="material-symbols-outlined">add_circle</span>
				Create your own SUP tour!
			</a>
		</div>
	{/if}

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
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 1rem;
		background: var(--color-surface);
		border-bottom: var(--border-width) solid var(--color-border-light);
	}

	.tours-bar__count {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.tours-bar__filtered {
		color: var(--color-primary);
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
		min-width: 1.2rem;
		height: 1.2rem;
		padding: 0 0.3rem;
		border-radius: var(--border-radius-full);
		background: var(--color-primary);
		color: white;
		font-size: 0.65rem;
		font-weight: 700;
	}

	/* ---- FILTER DRAWER ---- */
	.tours-filter {
		padding: 0.75rem 1rem;
		background: var(--color-surface);
		border-bottom: var(--border-width) solid var(--color-border-light);
	}

	.tours-filter__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.tours-filter__label {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text);
	}

	.tours-filter__clear {
		background: none;
		border: none;
		font: inherit;
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--color-primary);
		cursor: pointer;
		padding: 0.2rem 0.4rem;
		border-radius: var(--border-radius-sm);
	}

	.tours-filter__clear:hover {
		background: var(--color-primary-light);
	}

	.tours-filter__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.tours-filter__tag {
		padding: 0.3rem 0.7rem;
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

	.tours-filter__tag:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.tours-filter__tag--active {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	.tours-filter__tag--active:hover {
		background: var(--color-primary-dark);
		border-color: var(--color-primary-dark);
		color: white;
	}

	/* ---- CONTENT ---- */
	.tours-content {
		padding: 1.25rem 1rem 2rem;
	}

	/* ---- STICKY CTA (mobile) ---- */
	.tours-create-hint {
		position: sticky;
		bottom: 5rem;
		z-index: 20;
		padding: 0 1rem;
		margin-bottom: 1rem;
	}

	.tours-create-hint__link {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--color-surface);
		border: 2px dashed var(--color-primary);
		border-radius: var(--border-radius-lg);
		color: var(--color-primary);
		font-size: var(--font-size-sm);
		font-weight: 600;
		text-decoration: none;
		transition: background var(--transition-fast);
	}

	.tours-create-hint__link:hover {
		background: var(--color-primary-light);
		text-decoration: none;
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

		.tours-filter {
			padding: 0.75rem 2rem;
		}

		.tours-content {
			padding: 2rem 2rem 3rem;
		}

		.tours-fab {
			display: flex;
		}

		.tours-create-hint {
			display: none;
		}
	}

	@media (min-width: 1232px) {
		.tours-bar {
			border-radius: 0 0 var(--border-radius) var(--border-radius);
		}
	}
</style>
