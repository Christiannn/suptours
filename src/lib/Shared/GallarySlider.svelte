<script lang="ts">
	type GalleryImage = {
		id: string;
		image_url: string;
		description: string | null;
		quote: string | null;
		link_to_url: string | null;
		hidden: boolean;
		tags: string[];
	};

	let { galleryId, images = [] }: { galleryId: string; images?: GalleryImage[] } = $props();

	let current = $state(0);
	const hasImages = $derived(images.length > 0);
	const maxIndex = $derived(Math.max(images.length - 1, 0));

	function goTo(index: number) {
		if (!hasImages) return;
		if (index < 0) {
			current = maxIndex;
			return;
		}
		if (index > maxIndex) {
			current = 0;
			return;
		}
		current = index;
	}

	function prev() {
		goTo(current - 1);
	}

	function next() {
		goTo(current + 1);
	}

	const translate = $derived(`translateX(calc(50% - (var(--slide-width) / 2) - (${current} * (var(--slide-width) + var(--slide-gap)))))`);
</script>

<section class="gallery-slider" aria-label={`Gallery ${galleryId}`}>
	{#if hasImages}
		<div class="slider-shell">
			<button type="button" class="nav-button left" aria-label="Previous image" onclick={prev}>
				&#10094;
			</button>

			<div class="viewport">
				<div class="track" style={`transform: ${translate};`}>
					{#each images as image, i (image.id)}
						<article class="slide" class:active={i === current}>
							{#if image.link_to_url}
								<button
									type="button"
									class="image-link"
									aria-label={`Open linked page for image ${i + 1}`}
									onclick={() => window.open(image.link_to_url as string, '_blank', 'noopener,noreferrer')}
								>
									<img src={image.image_url} alt={image.description ?? `Gallery image ${i + 1}`} loading="lazy" />
								</button>
							{:else}
								<img src={image.image_url} alt={image.description ?? `Gallery image ${i + 1}`} loading="lazy" />
							{/if}

							{#if image.quote}
								<div class="quote-overlay">
									<p>{image.quote}</p>
								</div>
							{/if}

							{#if image.description}
								<p class="caption">{image.description}</p>
							{/if}
						</article>
					{/each}
				</div>
			</div>

			<button type="button" class="nav-button right" aria-label="Next image" onclick={next}>
				&#10095;
			</button>
		</div>

		<div class="dots" role="tablist" aria-label="Gallery image navigation">
			{#each images as image, i (image.id)}
				<button
					type="button"
					role="tab"
					aria-selected={i === current}
					class="dot"
					class:active={i === current}
					onclick={() => goTo(i)}
				>
					<span class="sr-only">Go to image {i + 1}</span>
				</button>
			{/each}
		</div>
	{:else}
		<p class="empty">No gallery images available.</p>
	{/if}
</section>

<style>
	.gallery-slider {
		--slide-width: 60%;
		--slide-gap: 1rem;
		display: grid;
		gap: 0.75rem;
	}

	.slider-shell {
		position: relative;
		display: grid;
		grid-template-columns: 2.25rem 1fr 2.25rem;
		align-items: center;
		gap: 0.5rem;
	}

	.viewport {
		overflow: hidden;
		padding: 0.5rem 0;
	}

	.track {
		display: flex;
		gap: var(--slide-gap);
		transition: transform 350ms ease;
		will-change: transform;
	}

	.slide {
		flex: 0 0 var(--slide-width);
		position: relative;
		border-radius: var(--border-radius-lg);
		overflow: hidden;
		background: var(--color-bg-muted);
		transform: scale(0.94);
		opacity: 0.75;
		transition:
			transform 350ms ease,
			opacity 350ms ease;
	}

	.slide.active {
		transform: scale(1);
		opacity: 1;
	}

	.slide img {
		display: block;
		width: 100%;
		height: min(54vh, 28rem);
		object-fit: cover;
	}

	.image-link {
		all: unset;
		cursor: pointer;
		display: block;
	}

	.quote-overlay {
		position: absolute;
		inset: auto 0 0;
		padding: 1rem;
		background: linear-gradient(transparent, rgb(0 0 0 / 70%));
		color: white;
		z-index: 2;
	}

	.quote-overlay p {
		margin: 0;
		font-size: var(--font-size-lg);
		font-style: italic;
	}

	.caption {
		margin: 0.5rem 0 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.nav-button {
		height: 2.25rem;
		width: 2.25rem;
		border-radius: 999px;
		background: var(--color-bg);
		border: var(--border-width) solid var(--color-border);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.dots {
		display: flex;
		justify-content: center;
		gap: 0.4rem;
	}

	.dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
		padding: 0;
		border: none;
		background: var(--color-border);
	}

	.dot.active {
		background: var(--color-accent);
	}

	.sr-only {
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

	.empty {
		margin: 0;
		color: var(--color-text-muted);
	}

	@media (max-width: 767px) {
		.gallery-slider {
			--slide-width: 92%;
			--slide-gap: 0.65rem;
		}

		.slider-shell {
			display: block; /* Remove grid on mobile to allow absolute positioning of buttons */
		}

		.nav-button {
			position: absolute;
			top: 50%;
			transform: translateY(-50%);
			z-index: 10;
			background: white;
			border: none;
			box-shadow: 0 2px 8px rgba(0,0,0,0.2);
			opacity: 1; /* Not transparent */
		}

		.nav-button.left {
			left: 0.5rem;
		}

		.nav-button.right {
			right: 0.5rem;
		}
	}
</style>
