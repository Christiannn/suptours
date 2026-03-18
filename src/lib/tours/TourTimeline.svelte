<script lang="ts">
	import type { TourGroup, Tour } from './dateGrouping';
	import TourCard from './TourCard.svelte';

	let {
		groups,
		onselect,
		user = null
	}: {
		groups: TourGroup[];
		onselect: (tour: Tour) => void;
		user?: any;
	} = $props();
</script>

<div class="timeline">
	{#each groups as group, gi (group.label)}
		<div class="timeline__group">
			<!-- Group header with dot -->
			<div class="timeline__header">
				<div class="timeline__dot" class:timeline__dot--first={gi === 0}>
					{#if gi === 0}
						<span class="timeline__dot-pulse"></span>
					{/if}
				</div>
				<h2 class="timeline__label" class:timeline__label--first={gi === 0}>
					{group.label}
				</h2>
			</div>

			<!-- Tour cards -->
			<div class="timeline__cards">
				{#each group.tours as tour (tour.id)}
					<TourCard {tour} onclick={() => onselect(tour)} {user} />
				{/each}
			</div>
		</div>
	{/each}

	{#if groups.length === 0}
		<div class="timeline__empty">
			<div class="timeline__empty-icon">
				<span class="material-symbols-outlined">kayaking</span>
			</div>
			<p class="timeline__empty-title">No upcoming tours</p>
			<p class="timeline__empty-text">Be the first to create a SUP tour!</p>
		</div>
	{/if}

	<!-- Timeline vertical line -->
	{#if groups.length > 0}
		<div class="timeline__line"></div>
	{/if}
</div>

<style>
	.timeline {
		position: relative;
		padding-left: 2rem;
	}

	.timeline__line {
		position: absolute;
		left: 0.6875rem; /* center of 1.375rem dot */
		top: 0.6875rem;
		bottom: 2rem;
		width: 2px;
		background: var(--color-primary);
		opacity: 0.25;
		z-index: 0;
	}

	.timeline__group {
		position: relative;
		z-index: 1;
		margin-bottom: 1.75rem;
	}

	.timeline__group:last-of-type {
		margin-bottom: 0;
	}

	.timeline__header {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.85rem;
	}

	/* ---- DOT ---- */
	.timeline__dot {
		position: absolute;
		left: -2rem;
		width: 1.375rem;
		height: 1.375rem;
		border-radius: var(--border-radius-full);
		background: var(--color-surface);
		border: 3px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
		box-sizing: border-box;
	}

	.timeline__dot--first {
		background: var(--color-primary);
		border-color: var(--color-primary);
		box-shadow: 0 0 0 4px rgba(19, 200, 236, 0.15);
	}

	.timeline__dot-pulse {
		position: absolute;
		width: 100%;
		height: 100%;
		border-radius: var(--border-radius-full);
		background: var(--color-primary);
		animation: dot-pulse 2.5s ease-in-out infinite;
	}

	@keyframes dot-pulse {
		0%, 100% { transform: scale(1); opacity: 0.4; }
		50% { transform: scale(1.8); opacity: 0; }
	}

	/* ---- LABEL ---- */
	.timeline__label {
		margin: 0;
		font-size: var(--font-size-base);
		font-weight: 700;
		color: var(--color-text-muted);
	}

	.timeline__label--first {
		color: var(--color-text);
		font-size: var(--font-size-lg);
	}

	/* ---- CARDS ---- */
	.timeline__cards {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* ---- EMPTY STATE ---- */
	.timeline__empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 3rem 1.5rem;
		border: 2px dashed var(--color-border);
		border-radius: var(--border-radius-lg);
		background: var(--color-bg-muted);
	}

	.timeline__empty-icon {
		width: 3.5rem;
		height: 3.5rem;
		border-radius: var(--border-radius-full);
		background: var(--color-primary-light);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.75rem;
		color: var(--color-primary);
	}

	.timeline__empty-icon .material-symbols-outlined {
		font-size: 28px;
	}

	.timeline__empty-title {
		margin: 0;
		font-weight: 700;
		font-size: var(--font-size-lg);
		color: var(--color-text);
	}

	.timeline__empty-text {
		margin: 0.3rem 0 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	/* ---- RESPONSIVE ---- */
	@media (min-width: 768px) {
		.timeline {
			padding-left: 2.5rem;
		}

		.timeline__dot {
			left: -2.5rem;
			width: 1.5rem;
			height: 1.5rem;
		}

		.timeline__line {
			left: 0.75rem;
			top: 0.75rem;
		}

		.timeline__cards {
			gap: 1.25rem;
		}

		.timeline__group {
			margin-bottom: 2.25rem;
		}
	}
</style>
