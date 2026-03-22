<script lang="ts">
	let { data } = $props();

	type Product = (typeof data.products)[number];

	let filterOpen = $state(false);
	let activeTags = $state<string[]>([]);
	let searchQuery = $state('');
	let selectedProductId = $state<string | null>(null);
	let cardImageIndex = $state<Record<string, number>>({});
	let modalImageIndex = $state(0);

	const palette = [
		['#1f2937', '#2563eb'],
		['#0f766e', '#14b8a6'],
		['#7c2d12', '#fb923c'],
		['#4c1d95', '#a855f7'],
		['#1e3a8a', '#60a5fa'],
	];

	const allTags = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const product of data.products) {
			for (const tag of product.tags ?? []) {
				counts[tag] = (counts[tag] ?? 0) + 1;
			}
		}
		return Object.entries(counts)
			.sort((a, b) => b[1] - a[1])
			.map(([tag]) => tag);
	});

	const filteredProducts = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		return data.products.filter((product: Product) => {
			const matchesSearch =
				!q ||
				product.name.toLowerCase().includes(q) ||
				(product.address ?? '').toLowerCase().includes(q) ||
				(product.tags ?? []).join(' ').toLowerCase().includes(q);
			const matchesTags =
				activeTags.length === 0 ||
				activeTags.some((tag) => (product.tags ?? []).includes(tag));
			return matchesSearch && matchesTags;
		});
	});

	const displayProducts = $derived.by(() => {
		return [...filteredProducts].sort((a, b) => hashId(a.id) - hashId(b.id));
	});

	const selectedProduct = $derived.by(() => {
		if (!selectedProductId) return null;
		return data.products.find((p) => p.id === selectedProductId) ?? null;
	});

	function hashId(id: string): number {
		let hash = 0;
		for (let i = 0; i < id.length; i++) {
			hash = (hash * 31 + id.charCodeAt(i)) % 9973;
		}
		return hash;
	}

	function getFallbackBg(id: string): string {
		const [from, to] = palette[hashId(id) % palette.length];
		return `linear-gradient(140deg, ${from}, ${to})`;
	}

	function toggleTag(tag: string) {
		activeTags = activeTags.includes(tag)
			? activeTags.filter((t) => t !== tag)
			: [...activeTags, tag];
	}

	function clearFilters() {
		activeTags = [];
	}

	function openProduct(product: Product) {
		selectedProductId = product.id;
		modalImageIndex = 0;
	}

	function closeModal() {
		selectedProductId = null;
	}

	function moveCardImage(product: Product, delta: number, event: Event) {
		event.stopPropagation();
		const total = product.image_urls?.length ?? 0;
		if (total <= 1) return;
		const current = cardImageIndex[product.id] ?? 0;
		cardImageIndex = {
			...cardImageIndex,
			[product.id]: (current + delta + total) % total,
		};
	}

	function moveModalImage(delta: number) {
		if (!selectedProduct) return;
		const total = selectedProduct.image_urls?.length ?? 0;
		if (total <= 1) return;
		modalImageIndex = (modalImageIndex + delta + total) % total;
	}
</script>

<svelte:head>
	<title>Marketplace — SUP Tours</title>
</svelte:head>

<div class="marketplace-page">
	<div class="market-bar" class:market-bar--filter-open={filterOpen}>
		<div class="market-bar__main">
			<div class="market-search">
				<label class="market-search__label" for="market-search">Search products</label>
				<input
					id="market-search"
					class="market-search__input"
					type="search"
					placeholder="Name, tags, location…"
					bind:value={searchQuery}
				/>
			</div>
			<div class="market-actions">
				{#if filterOpen}
					<div class="market-tags-inline">
						{#each allTags as tag (tag)}
							<button
								type="button"
								class="market-tag"
								class:market-tag--active={activeTags.includes(tag)}
								onclick={() => toggleTag(tag)}
							>
								{tag}
							</button>
						{/each}
					</div>
				{/if}
				<div class="market-filter-group">
					<button
						type="button"
						class="market-filter-btn"
						class:market-filter-btn--active={filterOpen || activeTags.length > 0}
						onclick={() => (filterOpen = !filterOpen)}
					>
						<span class="material-symbols-outlined">tune</span>
						{#if activeTags.length === 0}
							Quick filter
						{:else}
							<span class="market-filter-count">{activeTags.length}</span>
						{/if}
					</button>
					{#if activeTags.length > 0}
						<button type="button" class="market-filter-clear" onclick={clearFilters}>
							<span class="material-symbols-outlined">close</span>
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<div class="cards">
		{#if displayProducts.length === 0}
			<p class="empty">No products found for your current search/filter.</p>
		{:else}
			{#each displayProducts as product (product.id)}
				<div
					class="card"
					role="button"
					tabindex="0"
					onclick={() => openProduct(product)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							openProduct(product);
						}
					}}
				>
					<div class="card__media">
						{#if (product.image_urls?.length ?? 0) > 0}
							<img
								src={product.image_urls[cardImageIndex[product.id] ?? 0]}
								alt={product.name}
								loading="lazy"
							/>
							{#if product.image_urls.length > 1}
								<div class="card__nav">
									<button type="button" onclick={(e) => moveCardImage(product, -1, e)}>&lt;</button>
									<button type="button" onclick={(e) => moveCardImage(product, 1, e)}>&gt;</button>
								</div>
							{/if}
						{:else}
							<div class="card__placeholder" style={`background: ${getFallbackBg(product.id)}`}></div>
						{/if}
						<h2>{product.name}</h2>
					</div>

					<div class="card__meta">
						<p>
							<strong>{(product.tags ?? []).join(' · ') || 'SUP'}</strong>
							{#if product.price_label} | {product.price_label}{/if}
							{#if product.address} | {product.address}{/if}
						</p>
						<a
							class="card__link-box"
							href={product.url}
							target="_blank"
							rel="noopener"
							title={product.url}
							onclick={(e) => e.stopPropagation()}
						>
							{product.url}
						</a>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

{#if selectedProduct}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="0"
		onclick={closeModal}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				closeModal();
			}
		}}
	>
		<div
			class="modal"
			role="dialog"
			tabindex="0"
			aria-modal="true"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<button type="button" class="modal__close" onclick={closeModal}>
				<span class="material-symbols-outlined">close</span>
			</button>
			<div class="modal__media">
				{#if (selectedProduct.image_urls?.length ?? 0) > 0}
					<img src={selectedProduct.image_urls[modalImageIndex]} alt={selectedProduct.name} />
					{#if selectedProduct.image_urls.length > 1}
						<div class="modal__nav">
							<button type="button" onclick={() => moveModalImage(-1)}>&lt;</button>
							<span>{modalImageIndex + 1}/{selectedProduct.image_urls.length}</span>
							<button type="button" onclick={() => moveModalImage(1)}>&gt;</button>
						</div>
					{/if}
				{:else}
					<div class="modal__placeholder" style={`background: ${getFallbackBg(selectedProduct.id)}`}></div>
				{/if}
			</div>
			<div class="modal__body">
				<h3>{selectedProduct.name}</h3>
				<p class="modal__line"><strong>Tags:</strong> {(selectedProduct.tags ?? []).join(', ') || 'SUP'}</p>
				{#if selectedProduct.price_label}
					<p class="modal__line"><strong>Price:</strong> {selectedProduct.price_label}</p>
				{/if}
				{#if selectedProduct.address}
					<p class="modal__line"><strong>Address:</strong> {selectedProduct.address}</p>
				{/if}
				{#if selectedProduct.contact_info}
					<p class="modal__line"><strong>Contact:</strong> {selectedProduct.contact_info}</p>
				{/if}
				<a class="modal__cta" href={selectedProduct.url} target="_blank" rel="noopener">Open product page</a>
			</div>
		</div>
	</div>
{/if}

<style>
	.marketplace-page {
		max-width: 1200px;
		margin: 0 auto;
	}

	.market-bar {
		position: sticky;
		top: 0;
		z-index: 40;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border-light);
		padding: 0.6rem 1rem;
	}

	.market-bar__main {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		justify-content: space-between;
	}

	.market-search {
		flex: 1;
		min-width: 0;
	}

	.market-search__label {
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

	.market-search__input {
		width: 100%;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius);
		font: inherit;
		background: var(--color-bg);
	}

	.market-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
		justify-content: flex-end;
		min-width: 0;
	}

	.market-tags-inline {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		overflow-x: auto;
		padding-bottom: 2px;
		scrollbar-width: none;
	}

	.market-tags-inline::-webkit-scrollbar {
		display: none;
	}

	.market-tag {
		padding: 0.3rem 0.65rem;
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius-full);
		background: var(--color-surface);
		font: inherit;
		font-size: var(--font-size-xs);
		cursor: pointer;
		white-space: nowrap;
	}

	.market-tag--active {
		background: var(--color-primary);
		border-color: var(--color-primary-border);
		color: white;
	}

	.market-filter-group {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
	}

	.market-filter-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius-full);
		background: var(--color-surface);
		cursor: pointer;
		font: inherit;
		font-size: var(--font-size-sm);
		font-weight: 500;
	}

	.market-filter-btn--active {
		color: var(--color-primary);
		border-color: var(--color-primary);
	}

	.market-filter-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.2rem;
		height: 1.2rem;
		border-radius: 999px;
		background: var(--color-primary);
		color: white;
		font-size: 0.75rem;
	}

	.market-filter-clear {
		border: none;
		background: transparent;
		color: var(--color-primary);
		cursor: pointer;
		padding: 0.25rem;
	}

	.cards {
		padding: 1rem;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.9rem;
	}

	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border-light);
		border-radius: var(--border-radius-lg);
		overflow: hidden;
		cursor: pointer;
		display: flex;
		flex-direction: column;
	}

	.card__media {
		position: relative;
		height: 180px;
	}

	.card__media img,
	.card__placeholder {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.card__media h2 {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		margin: 0;
		padding: 0.5rem 0.65rem;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
		color: white;
		font-size: 1.1rem;
		line-height: 1.2;
	}

	.card__nav {
		position: absolute;
		top: 0.45rem;
		right: 0.45rem;
		display: flex;
		gap: 0.35rem;
	}

	.card__nav button {
		border: 1px solid rgba(255, 255, 255, 0.5);
		background: rgba(0, 0, 0, 0.5);
		color: white;
		border-radius: var(--border-radius);
		width: 1.9rem;
		height: 1.9rem;
		cursor: pointer;
	}

	.card__meta {
		padding: 0.7rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.card__meta p {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.card__link-box {
		display: block;
		width: 100%;
		padding: 0.45rem 0.6rem;
		border-radius: var(--border-radius-full);
		border: 1px solid var(--color-primary-border);
		background: rgba(var(--color-primary-rgb), 0.1);
		color: var(--color-primary);
		font-size: var(--font-size-xs);
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
	}

	.card__link-box:hover {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary-border);
	}

	.empty {
		padding: 2rem 1rem;
		text-align: center;
		color: var(--color-text-muted);
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: grid;
		place-items: center;
		padding: 1rem;
		z-index: 120;
	}

	.modal {
		width: min(760px, 100%);
		max-height: 90vh;
		overflow: auto;
		background: var(--color-surface);
		border-radius: var(--border-radius-lg);
		border: 1px solid var(--color-border-light);
		position: relative;
	}

	.modal__close {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		border: none;
		background: rgba(0, 0, 0, 0.45);
		color: white;
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		cursor: pointer;
		z-index: 2;
	}

	.modal__media {
		position: relative;
		height: 320px;
	}

	.modal__media img,
	.modal__placeholder {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.modal__nav {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 0.5rem;
		background: rgba(0, 0, 0, 0.45);
		color: white;
	}

	.modal__nav button {
		border: 1px solid rgba(255, 255, 255, 0.55);
		background: transparent;
		color: white;
		border-radius: var(--border-radius);
		width: 2rem;
		height: 2rem;
		cursor: pointer;
	}

	.modal__body {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.modal__body h3 {
		margin: 0;
		font-size: 1.3rem;
	}

	.modal__line {
		margin: 0;
		color: var(--color-text-muted);
	}

	.modal__cta {
		margin-top: 0.35rem;
		align-self: flex-start;
		text-decoration: none;
		padding: 0.5rem 0.9rem;
		border-radius: var(--border-radius-full);
		background: var(--color-primary);
		border: 1px solid var(--color-primary-border);
		color: white;
		font-weight: 600;
	}

	@media (max-width: 767px) {
		.cards {
			grid-template-columns: 1fr;
		}

		.market-bar__main {
			flex-direction: column;
			align-items: stretch;
			gap: 0.6rem;
		}

		.market-actions {
			justify-content: space-between;
		}

		.market-bar:not(.market-bar--filter-open) .market-tags-inline {
			display: none;
		}

		.market-bar--filter-open .market-actions {
			flex-direction: column;
			align-items: stretch;
		}

		.market-bar--filter-open .market-tags-inline {
			display: flex;
		}
	}

	@media (min-width: 900px) {
		.cards {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (min-width: 1240px) {
		.cards {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
</style>
