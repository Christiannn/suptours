<script lang="ts">
	let { tag }: { tag: string } = $props();

	const tagColors: Record<string, string> = {
		race: '#ef4444',
		social: '#8b5cf6',
		beginner: '#22c55e',
		waves: '#3b82f6',
		expert: '#f97316',
		adventure: '#eab308',
		yoga: '#ec4899',
		family: '#14b8a6',
		camping: '#84cc16'
	};

	const color = $derived(tagColors[tag.toLowerCase()] ?? 'var(--color-text-muted)');
</script>

<span class="tag-badge" style="--tag-color: {color}">
	{tag}
</span>

<style>
	.tag-badge {
		display: inline-block;
		padding: 0.15rem 0.5rem;
		font-size: var(--font-size-xs);
		font-weight: 600;
		border-radius: var(--border-radius-full);
		background: color-mix(in srgb, var(--tag-color) 12%, transparent);
		color: var(--tag-color);
		text-transform: capitalize;
		white-space: nowrap;
	}
</style>
