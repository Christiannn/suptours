<script lang="ts">
	import { resolve } from '$app/paths';
	import { fly } from 'svelte/transition';
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import TourTimeline from '$lib/tours/TourTimeline.svelte';
	import TourModal from '$lib/tours/TourModal.svelte';
	import { groupToursByDate, type Tour } from '$lib/tours/dateGrouping';
	import { buildToursPageJsonLdWithSpotlight, safeJsonLdStringify } from '$lib/tours/schemaOrg';
	import { getTourShowSlug } from '$lib/tours/tourSlug';
	import { searchTours } from '$lib/tours/searchTours';

	let { data } = $props();

	let filterOpen = $state(false);
	let activeTags = $state<string[]>([]);
	let visibleCount = $state(5);
	let loadMoreTrigger = $state<HTMLElement | null>(null);
	/** Draft search text; synced from URL when the URL changes */
	let searchDraft = $state('');
	/** Search field expanded (icon → input); also open when URL has an active search */
	let searchExpanded = $state(false);
	let searchInputEl = $state<HTMLInputElement | null>(null);

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

	const toursJsonLdString = $derived.by(() =>
		safeJsonLdStringify(buildToursPageJsonLdWithSpotlight(page.url.origin, data.tours, selectedTour)),
	);

	const searchQuery = $derived(page.url.searchParams.get('search')?.trim() ?? '');
	const searchActive = $derived(Boolean(searchQuery));
	const searchOpen = $derived(searchExpanded || searchActive);

	$effect(() => {
		searchDraft = page.url.searchParams.get('search') ?? '';
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

	const searchFilteredTours = $derived.by(() => {
		if (!searchQuery) return data.tours;
		return searchTours(data.tours, searchQuery, 10);
	});

	// Filter tours by selected tags (after search)
	const filteredTours = $derived.by(() => {
		if (activeTags.length === 0) return searchFilteredTours;
		return searchFilteredTours.filter((tour: Tour) =>
			activeTags.some((tag) => tour.tags.includes(tag)),
		);
	});

	// Slice tours for pagination (search mode: already capped at 10)
	const visibleTours = $derived.by(() => {
		if (searchActive) return filteredTours;
		return filteredTours.slice(0, visibleCount);
	});
	const hasMore = $derived(
		!searchActive && visibleCount < filteredTours.length,
	);

	const groups = $derived(groupToursByDate(visibleTours));

	function toggleTag(tag: string) {
		activeTags = activeTags.includes(tag)
			? activeTags.filter((t) => t !== tag)
			: [...activeTags, tag];
		visibleCount = 5; // Reset pagination on filter change
	}

	function clearFilters() {
		activeTags = [];
		visibleCount = 5;
	}

	function applySearch(e: Event) {
		e.preventDefault();
		const url = new URL(page.url);
		const q = searchDraft.trim();
		if (q) url.searchParams.set('search', q);
		else url.searchParams.delete('search');
		visibleCount = 5;
		goto(url.toString(), { replaceState: true, keepFocus: true, noScroll: true });
	}

	function clearSearch() {
		const url = new URL(page.url);
		url.searchParams.delete('search');
		visibleCount = 5;
		searchExpanded = false;
		goto(url.toString(), { replaceState: true, keepFocus: true, noScroll: true });
	}

	async function toggleSearch() {
		if (searchActive) {
			await tick();
			searchInputEl?.focus();
			return;
		}
		if (searchExpanded) {
			searchExpanded = false;
			return;
		}
		searchExpanded = true;
		filterOpen = false;
		await tick();
		searchInputEl?.focus();
	}

	function closeSearchPanel() {
		if (searchActive) return;
		searchExpanded = false;
	}

	function toggleFilterOpen() {
		const next = !filterOpen;
		filterOpen = next;
		if (next) searchExpanded = false;
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
	{@html `<script type="application/ld+json">${toursJsonLdString}</script>`}
</svelte:head>

<div class="tours-page">
	<!-- Search + filter bar -->
	<div class="tours-bar" class:tours-bar--filter-open={filterOpen}>
		<div class="tours-bar__main">
			<form
				class="tours-search"
				class:tours-search--open={searchOpen}
				onsubmit={applySearch}
				role="search"
				aria-label="Search tours"
			>
				<label class="tours-search__label" for="tours-search-input">Search tours</label>
				<button
					type="button"
					class="tours-search__toggle"
					onclick={toggleSearch}
					aria-expanded={searchOpen}
					aria-controls="tours-search-input"
					aria-label={searchOpen ? 'Search tours (focus field)' : 'Open search'}
				>
					<span class="material-symbols-outlined" aria-hidden="true">search</span>
				</button>
				<div class="tours-search__panel" inert={!searchOpen}>
					<input
						id="tours-search-input"
						bind:this={searchInputEl}
						class="tours-search__input"
						type="search"
						name="search"
						placeholder="Title, place, tags…"
						autocomplete="off"
						bind:value={searchDraft}
					/>
					<button type="submit" class="tours-search__submit">Search</button>
					{#if searchActive}
						<button type="button" class="tours-search__clear" onclick={clearSearch}>Clear</button>
					{:else if searchOpen}
						<button type="button" class="tours-search__close" onclick={closeSearchPanel} aria-label="Close search">
							<span class="material-symbols-outlined" aria-hidden="true">close</span>
						</button>
					{/if}
				</div>
			</form>

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
						onclick={toggleFilterOpen}
						aria-label="Quick filter tours"
					>
						<span class="material-symbols-outlined">tune</span>
						{#if activeTags.length === 0}
							Quick filter
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
		{#if searchActive}
			<p class="tours-search__hint">Showing up to 10 best matches for “{searchQuery}”.</p>
		{/if}
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

	/* ---- INLINE SEARCH (icon expands to field) ---- */
	.tours-search {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex: 1;
		min-width: 0;
		max-width: 100%;
		margin: 0;
	}

	.tours-search__label {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.tours-search__toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		border-radius: var(--border-radius-full);
		border: var(--border-width) solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
		flex-shrink: 0;
		transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
	}

	.tours-search__toggle:hover {
		background: var(--color-bg-muted);
	}

	.tours-search--open .tours-search__toggle {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.tours-search__toggle .material-symbols-outlined {
		font-size: 22px;
	}

	.tours-search__panel {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex: 0 0 0;
		min-width: 0;
		max-width: 0;
		opacity: 0;
		overflow: hidden;
		pointer-events: none;
		transition:
			flex 0.24s ease,
			max-width 0.24s ease,
			opacity 0.2s ease;
	}

	.tours-search--open .tours-search__panel {
		flex: 1 1 auto;
		max-width: min(28rem, 100%);
		opacity: 1;
		pointer-events: auto;
	}

	.tours-search__input {
		flex: 1;
		min-width: 0;
		padding: 0.4rem 0.55rem;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
		font: inherit;
		font-size: var(--font-size-sm);
		background: var(--color-bg);
		color: var(--color-text);
	}

	.tours-search__input:focus {
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}

	.tours-search__submit,
	.tours-search__clear {
		font: inherit;
		font-size: var(--font-size-sm);
		padding: 0.4rem 0.65rem;
		border-radius: var(--border-radius);
		cursor: pointer;
		border: var(--border-width) solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		flex-shrink: 0;
		white-space: nowrap;
	}

	.tours-search__submit {
		background: var(--color-primary);
		color: #fff;
		border-color: var(--color-primary-border);
		font-weight: 600;
	}

	.tours-search__clear {
		background: transparent;
	}

	.tours-search__close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: none;
		border-radius: var(--border-radius-full);
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		flex-shrink: 0;
	}

	.tours-search__close:hover {
		background: var(--color-bg-muted);
		color: var(--color-text);
	}

	.tours-search__close .material-symbols-outlined {
		font-size: 20px;
	}

	.tours-search__hint {
		margin: 0.35rem 0 0;
		padding: 0;
		font-size: 0.8rem;
		color: var(--color-text-muted);
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
		min-width: 0;
	}

	.tours-bar__actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
		min-width: 0;
		flex: 1;
	}

	/* Small screens: search open → full width, hide quick filter (unless filter flyout is open) */
	@media (max-width: 767px) {
		.tours-bar:not(.tours-bar--filter-open) .tours-bar__main:has(.tours-search--open) .tours-bar__actions {
			display: none;
		}

		.tours-bar:not(.tours-bar--filter-open) .tours-bar__main:has(.tours-search--open) .tours-search {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
		}

		.tours-bar:not(.tours-bar--filter-open) .tours-bar__main:has(.tours-search--open) .tours-search__panel {
			max-width: 100%;
		}

		/* Quick filter open → full width flyout, hide search until filter closes */
		.tours-bar--filter-open .tours-search {
			display: none;
		}

		.tours-bar--filter-open .tours-bar__actions {
			flex: 1 1 100%;
			width: 100%;
			min-width: 0;
			flex-direction: column;
			align-items: stretch;
			justify-content: flex-start;
			gap: 0.65rem;
		}

		.tours-bar--filter-open .tours-bar__tags-inline {
			width: 100%;
			max-width: 100%;
		}

		.tours-bar--filter-open .tours-bar__filter-group {
			align-self: flex-end;
			flex-shrink: 0;
		}
	}

	.tours-bar__filter-group {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
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
		padding: 0.35rem;
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
		border-color: var(--color-primary-border);
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
		border: 1px solid var(--color-primary-border);
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
		border-color: var(--color-primary-border);
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

