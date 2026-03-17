<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { SvelteMap } from 'svelte/reactivity';
	import GalleryImageRow from '$lib/admin/GalleryImageRow.svelte';

	let { data, form } = $props();
	type SaveState = 'idle' | 'saving' | 'saved' | 'error';
	let saveStates = $state<Record<string, SaveState>>({});
	const saveTimers = new SvelteMap<string, ReturnType<typeof setTimeout>>();
	let showCreateGallery = $state(false);
	let toastMessage = $state('');
	let toastSuccess = $state(false);
	let showToast = $state(false);
	let lastToastKey = $state('');
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	function autosaveOnBlur(event: FocusEvent) {
		const element = event.currentTarget as HTMLInputElement | HTMLTextAreaElement;
		element.form?.requestSubmit();
	}

	function autosaveOnChange(event: Event) {
		const element = event.currentTarget as HTMLInputElement;
		element.form?.requestSubmit();
	}

	function setSaveState(key: string, state: SaveState) {
		saveStates = { ...saveStates, [key]: state };
		if (state !== 'saved') return;

		const existing = saveTimers.get(key);
		if (existing) clearTimeout(existing);
		const timer = setTimeout(() => {
			saveStates = { ...saveStates, [key]: 'idle' };
		}, 1500);
		saveTimers.set(key, timer);
	}

	function statusText(key: string) {
		const state = saveStates[key] ?? 'idle';
		if (state === 'saving') return 'Saving...';
		if (state === 'saved') return 'Saved';
		if (state === 'error') return 'Save failed';
		return '';
	}

	function enhanceWithStatus(key: string): SubmitFunction {
		return () => {
			setSaveState(key, 'saving');
			return async ({ result, update }) => {
				await update({ reset: false });
				if (result.type === 'success' || result.type === 'redirect') {
					setSaveState(key, 'saved');
					return;
				}
				setSaveState(key, 'error');
			};
		};
	}

	function createdGalleryIdFromResult(result: { type: string; data?: unknown }) {
		if (result.type !== 'success' || !result.data || typeof result.data !== 'object') return null;
		const galleryId = (result.data as { galleryId?: unknown }).galleryId;
		return typeof galleryId === 'string' && galleryId.length > 0 ? galleryId : null;
	}

	function openCreatedGallery(galleryId: string) {
		requestAnimationFrame(() => {
			const galleryElement = document.getElementById(`gallery-${galleryId}`) as HTMLDetailsElement | null;
			if (!galleryElement) return;
			galleryElement.open = true;
			galleryElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
	}

	function enhanceCreateGallery(): SubmitFunction {
		return () => {
			return async ({ result, update }) => {
				await update({ reset: true });
				if (result.type === 'success' || result.type === 'redirect') {
					showCreateGallery = false;
				}
				const galleryId = createdGalleryIdFromResult(result as { type: string; data?: unknown });
				if (galleryId) {
					openCreatedGallery(galleryId);
				}
			};
		};
	}

	$effect(() => {
		const message = form?.message;
		if (!message) return;
		const key = `${form?.success ? '1' : '0'}:${message}`;
		if (key === lastToastKey) return;
		lastToastKey = key;
		toastMessage = message;
		toastSuccess = !!form?.success;
		showToast = true;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => {
			showToast = false;
		}, 3000);
	});

</script>

<section class="gallary-page">
	{#if data.errorMessage}
		<p class="message">{data.errorMessage}</p>
	{/if}

	{#if data.galleries.length === 0}
		<p class="empty-state">No galleries yet.</p>
	{:else}
		{#each data.galleries as gallery (gallery.id)}
			<details class="gallery-accordion" id={`gallery-${gallery.id}`}>
				<summary>
					<div class="title-block">
						<strong class="gallery-title">{gallery.description || 'Untitled gallery'}</strong>
						<span class="edited-on">Edited: {new Date(gallery.edited_on).toLocaleString()}</span>
					</div>
					<span class:status-active={gallery.active} class:status-inactive={!gallery.active}>
						{gallery.active ? 'Active' : 'Inactive'}
					</span>
					<span class="meta-chip">{gallery.gallery_images.length} images</span>
				</summary>

				<div class="gallery-panel">
					<form
						method="POST"
						action="?/updateGallery"
						use:enhance={enhanceWithStatus(`gallery-${gallery.id}`)}
						class="gallery-info-form"
					>
						<input type="hidden" name="gallery_id" value={gallery.id} />
						<button type="submit" class="hidden-submit" aria-hidden="true" tabindex="-1">Save</button>
						<input
							name="description"
							value={gallery.description ?? ''}
							placeholder="Gallery description"
							aria-label="Gallery description"
							onblur={autosaveOnBlur}
						/>
						<label class="checkbox">
							<input
								type="checkbox"
								name="active"
								checked={gallery.active}
								onchange={autosaveOnChange}
							/>
							Active
						</label>
						<button type="submit" formaction="?/deleteGallery" class="danger danger-small">
							Delete
						</button>
						<span class="save-status">{statusText(`gallery-${gallery.id}`)}</span>
					</form>

					<form
						method="POST"
						action="?/uploadImage"
						use:enhance
						enctype="multipart/form-data"
						class="upload-new-image"
					>
						<input type="hidden" name="gallery_id" value={gallery.id} />
						<input type="file" name="image_file" accept="image/*" required aria-label="Upload image file" />
						<button type="submit">Upload image</button>
					</form>

					{#if gallery.gallery_images.length === 0}
						<p class="empty-state">No images in this gallery yet.</p>
					{:else}
						<div class="image-table">
							<div class="upload-table-head">
								<span>Image</span>
								<span>Description</span>
								<span>Quote</span>
								<span>Tags</span>
								<span>Link</span>
								<span>Hidden</span>
								<span>Actions</span>
							</div>
							<div class="upload-table-body">
								{#each gallery.gallery_images as image (image.id)}
									<GalleryImageRow {image} />
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</details>
		{/each}
	{/if}

	<div class="create-actions">
		<button
			type="button"
			class="primary"
			aria-expanded={showCreateGallery}
			aria-controls="new-gallery-accordion"
			onclick={() => (showCreateGallery = !showCreateGallery)}
		>
			{showCreateGallery ? 'Close new gallery form' : 'New gallery'}
		</button>
	</div>

	{#if showCreateGallery}
		<details class="gallery-accordion create-accordion" id="new-gallery-accordion" open>
			<summary>
				<strong class="gallery-title">Create new gallery</strong>
				<span class="meta-chip">Accordion form</span>
				<span class="meta-chip">Set title and status</span>
				<span class="meta-chip">Submit to create</span>
			</summary>
			<div class="gallery-panel">
				<form method="POST" action="?/createGallery" use:enhance={enhanceCreateGallery()} class="new-gallary-form">
					<label for="new-gallery-description">Title</label>
					<input id="new-gallery-description" name="description" placeholder="Gallery description" />
					<label class="checkbox">
						<input type="checkbox" name="active" checked />
						Active
					</label>
					<button type="submit" class="primary">Create gallery</button>
				</form>
			</div>
		</details>
	{/if}
</section>
{#if showToast}
	<div class="toast" class:success={toastSuccess} role="status" aria-live="polite">
		{toastMessage}
	</div>
{/if}

<style>
	.gallary-page {
		display: grid;
		gap: 0.25rem;
		width: 100%;
		max-width: none;
		padding: 0;
		background: transparent;
	}

	.new-gallary-form {
		display: grid;
		gap: 0.5rem;
		max-width: 34rem;
	}

	.gallery-accordion {
		border: var(--border-width) solid color-mix(in srgb, var(--color-border), #ccd8ef 45%);
		border-radius: var(--border-radius-lg);
		background: var(--color-bg);
		overflow: clip;
		box-shadow: 0 6px 20px rgb(15 37 77 / 6%);
		margin: 0.15rem 5px;
		padding: 0.5rem;
	}

	.gallery-accordion summary {
		display: grid;
		grid-template-columns: minmax(12rem, 1fr) repeat(2, auto);
		gap: 0.6rem;
		align-items: center;
		padding: 0;
		cursor: pointer;
		background: transparent;
	}

	.gallery-title {
		font-size: var(--font-size-base);
	}

	.title-block {
		display: grid;
		gap: 0.1rem;
	}

	.edited-on {
		font-size: 0.68rem;
		color: var(--color-text-muted);
	}

	.status-active,
	.status-inactive,
	.meta-chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		font-size: var(--font-size-xs);
		font-weight: 600;
		justify-self: end;
		text-align: right;
	}

	.status-active {
		color: #0d7a39;
		background: #dcfce7;
	}

	.status-inactive {
		color: #a63737;
		background: #fee2e2;
	}

	.meta-chip {
		color: var(--color-text-muted);
		background: color-mix(in srgb, var(--color-bg), var(--color-border) 85%);
	}

	.gallery-info-form {
		display: grid;
		grid-template-columns: minmax(14rem, 1fr) auto auto auto;
		gap: 0.65rem;
		align-items: center;
		padding: 0;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
		background: transparent;
	}

	.gallery-panel {
		display: grid;
		gap: 0.8rem;
		padding: 0;
	}

	.gallery-panel :global(input[type='text']),
	.gallery-panel :global(input[type='url']),
	.gallery-panel :global(input:not([type])) {
		width: 100%;
	}

	.upload-table-head {
		display: grid;
		grid-template-columns: 8rem repeat(4, minmax(0, 1fr)) 6.5rem 8.5rem;
		gap: 0.4rem;
		align-items: center;
		font-size: var(--font-size-xs);
		font-weight: 700;
		color: #3e4f69;
		padding: 0;
		border-bottom: var(--border-width) solid var(--color-border);
		background: transparent;
	}

	.image-table {
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
		overflow: clip;
		background: var(--color-bg);
	}

	.upload-table-body {
		padding: 0;
	}

	.upload-new-image {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.65rem;
		align-items: center;
		padding: 0;
		border: var(--border-width) dashed color-mix(in srgb, var(--color-border), #9eb5e0 40%);
		border-radius: var(--border-radius);
		background: transparent;
	}

	.message {
		margin: 0;
		padding: 0;
		border-radius: var(--border-radius);
		border: var(--border-width) solid #f7b6b6;
		background: transparent;
		color: #9e2222;
	}

	.empty-state {
		margin: 0;
		color: var(--color-text-muted);
		padding: 0;
		border: var(--border-width) dashed var(--color-border);
		border-radius: var(--border-radius);
		background: transparent;
	}

	.checkbox {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.hidden-submit {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		border: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}

	.danger-small {
		font-size: var(--font-size-xs);
		padding: 0.2rem 0.45rem;
		line-height: 1.1;
	}

	.save-status {
		min-width: 4.5rem;
		text-align: right;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.create-actions {
		display: flex;
		justify-content: flex-start;
		margin: 0 5px;
	}

	.create-accordion .gallery-panel {
		padding-top: 0;
	}

	.toast {
		position: fixed;
		left: 0.75rem;
		bottom: 0.75rem;
		z-index: 40;
		padding: 0.4rem 0.6rem;
		border-radius: var(--border-radius);
		border: var(--border-width) solid #f7b6b6;
		background: #fff2f2;
		color: #9e2222;
		font-size: var(--font-size-xs);
		box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
	}

	.toast.success {
		border-color: #93e0ad;
		background: #ecfdf3;
		color: #15733a;
	}

	@media (max-width: 1023px) {
		.gallery-accordion summary {
			grid-template-columns: 1fr;
		}

		.gallery-info-form,
		.upload-new-image {
			grid-template-columns: 1fr;
		}

		.save-status {
			text-align: left;
		}

		.upload-table-head {
			display: none;
		}
	}
</style>
