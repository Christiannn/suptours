<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { SvelteMap } from 'svelte/reactivity';

	type GalleryImage = {
		id: string;
		image_url: string;
		description: string | null;
		quote: string | null;
		tags: string[];
		link_to_url: string | null;
		hidden: boolean;
	};

	let { image }: { image: GalleryImage } = $props();

	type SaveState = 'idle' | 'saving' | 'saved' | 'error';
	let saveState = $state<SaveState>('idle');
	const timers = new SvelteMap<string, ReturnType<typeof setTimeout>>();

	let description = $state<string | undefined>(undefined);
	let quote = $state<string | undefined>(undefined);
	let tags = $state<string | undefined>(undefined);
	let linkToUrl = $state<string | undefined>(undefined);
	let hidden = $state<boolean | undefined>(undefined);

	function autosaveOnBlur(event: FocusEvent) {
		const element = event.currentTarget as HTMLInputElement;
		element.form?.requestSubmit();
	}

	function autosaveOnChange(event: Event) {
		const element = event.currentTarget as HTMLInputElement;
		element.form?.requestSubmit();
	}

	function setSaveState(state: SaveState) {
		saveState = state;
		if (state !== 'saved') return;
		const key = image.id;
		const existing = timers.get(key);
		if (existing) clearTimeout(existing);
		const timer = setTimeout(() => {
			saveState = 'idle';
		}, 1500);
		timers.set(key, timer);
	}

	function statusText() {
		if (saveState === 'saving') return 'Saving...';
		if (saveState === 'saved') return 'Saved';
		if (saveState === 'error') return 'Save failed';
		return '';
	}

	function enhanceWithStatus(): SubmitFunction {
		return () => {
			setSaveState('saving');
			return async ({ result, update }) => {
				await update({ reset: false });
				if (result.type === 'success' || result.type === 'redirect') {
					setSaveState('saved');
					return;
				}
				setSaveState('error');
			};
		};
	}

</script>

<div class="image-row">
	<div class="image-cell">
		<img src={image.image_url} alt={image.description ?? 'Gallery image'} />
	</div>
	<form method="POST" action="?/updateImage" use:enhance={enhanceWithStatus()} class="row-fields">
		<input type="hidden" name="image_id" value={image.id} />
		<input
			name="description"
			value={description ?? (image.description ?? '')}
			oninput={(event) => (description = event.currentTarget.value)}
			placeholder="Description"
			aria-label="Image description"
			onblur={autosaveOnBlur}
		/>
		<input
			name="quote"
			value={quote ?? (image.quote ?? '')}
			oninput={(event) => (quote = event.currentTarget.value)}
			placeholder="Quote"
			aria-label="Image quote"
			onblur={autosaveOnBlur}
		/>
		<input
			name="tags"
			value={tags ?? (image.tags?.join(', ') ?? '')}
			oninput={(event) => (tags = event.currentTarget.value)}
			placeholder="tag1, tag2"
			aria-label="Image tags"
			onblur={autosaveOnBlur}
		/>
		<input
			name="link_to_url"
			value={linkToUrl ?? (image.link_to_url ?? '')}
			oninput={(event) => (linkToUrl = event.currentTarget.value)}
			placeholder="https://..."
			aria-label="Image target link"
			onblur={autosaveOnBlur}
		/>
		<label class="checkbox center">
			<input
				type="checkbox"
				name="hidden"
				checked={hidden ?? image.hidden}
				onchange={(event) => {
					hidden = event.currentTarget.checked;
					autosaveOnChange(event);
				}}
			/>
			Hidden
		</label>
	</form>
	<div class="action-cell">
		<form method="POST" action="?/deleteImage" use:enhance>
			<input type="hidden" name="image_id" value={image.id} />
			<button type="submit" class="danger">Delete</button>
		</form>
		<span class="save-status">{statusText()}</span>
	</div>
</div>

<style>
	.image-row {
		display: grid;
		grid-template-columns: 8rem minmax(0, 1fr) 8.5rem;
		gap: 0.4rem;
		align-items: center;
		padding: 0.45rem 0;
		border-bottom: var(--border-width) solid color-mix(in srgb, var(--color-border), #d4def2 35%);
	}

	.image-cell {
		padding: 0.2rem;
	}

	.image-row img {
		width: 7rem;
		height: 4.5rem;
		object-fit: cover;
		border-radius: var(--border-radius-sm);
		background: var(--color-bg-muted);
	}

	.row-fields {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr)) 6.5rem;
		gap: 0.4rem;
		align-items: center;
	}

	.center {
		justify-content: center;
	}

	.action-cell {
		display: grid;
		gap: 0.35rem;
		justify-items: center;
	}

	.checkbox {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.save-status {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		min-height: 1.1rem;
	}

	@media (max-width: 1023px) {
		.image-row,
		.row-fields {
			grid-template-columns: 1fr;
		}

		.image-row {
			padding: 0.8rem 0;
		}

		.image-cell {
			padding: 0;
		}

		.action-cell {
			justify-items: start;
		}
	}
</style>
