<script lang="ts">
	import { browser } from '$app/environment';

	const STORAGE_KEY = 'ssbv1-cookie-consent';
	let accepted = $state(false);
	let mounted = $state(false);

	if (browser) {
		accepted = localStorage.getItem(STORAGE_KEY) === 'accepted';
		mounted = true;
	}

	function accept() {
		if (browser) {
			localStorage.setItem(STORAGE_KEY, 'accepted');
			accepted = true;
		}
	}
</script>

{#if mounted && !accepted}
	<div class="cookie-banner">
		<p class="cookie-text">
			We save anonymous use data to Supabase. Not shared with 3rd party.
		</p>
		<button type="button" onclick={accept} class="cookie-accept">OK</button>
	</div>
{/if}

<style>
	.cookie-banner {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem var(--section-padding);
		background: var(--color-bg-muted);
		border-top: var(--border-width) solid var(--color-border);
		font-size: var(--font-size-sm);
		z-index: 1000;
	}

	.cookie-text {
		margin: 0;
		flex: 1;
		min-width: 12rem;
	}

	.cookie-accept {
		flex-shrink: 0;
	}
</style>
