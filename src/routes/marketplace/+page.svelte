<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Marketplace — SUP Tours</title>
</svelte:head>

<div class="coming-soon">
	<div class="coming-soon__card">
		<span class="material-symbols-outlined coming-soon__icon">storefront</span>
		<h1>Marketplace</h1>
		<p>
			Buy and sell SUP equipment — boards, paddles, wetsuits, accessories.
			A trusted marketplace for the paddle community.
		</p>
		<p class="coming-soon__status">Coming soon!</p>
		<a href={resolve('/tours')} class="coming-soon__link">
			Browse tours in the meantime →
		</a>
	</div>
</div>

<style>
	.coming-soon {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 60vh;
		padding: 2rem 1rem;
	}

	.coming-soon__card {
		text-align: center;
		max-width: 24rem;
	}

	.coming-soon__icon {
		font-size: 64px;
		color: var(--color-primary);
		margin-bottom: 1rem;
	}

	.coming-soon__card h1 {
		margin: 0 0 0.75rem;
		font-size: var(--font-size-2xl);
	}

	.coming-soon__card p {
		color: var(--color-text-muted);
		margin: 0 0 0.75rem;
	}

	.coming-soon__status {
		font-weight: 700;
		color: var(--color-primary) !important;
		font-size: var(--font-size-lg);
	}

	.coming-soon__link {
		display: inline-block;
		margin-top: 0.5rem;
		font-weight: 600;
		color: var(--color-primary);
	}
</style>
