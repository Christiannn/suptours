<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import type { PendingTourRecap } from './reviewHelpers';

	let { tour }: { tour: PendingTourRecap } = $props();

	const supabase = createSupabaseBrowserClient();
	const maxReviewImageBytes = 5 * 1024 * 1024;

	let imageUrl = $state('');
	let uploading = $state(false);
	let uploadError = $state<string | null>(null);

	async function handleReviewImageUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;

		const file = target.files[0];
		if (!file.type.startsWith('image/')) {
			uploadError = 'Please choose an image file.';
			target.value = '';
			return;
		}
		if (file.size > maxReviewImageBytes) {
			uploadError = 'Image must be 5 MB or smaller.';
			target.value = '';
			return;
		}

		uploading = true;
		uploadError = null;

		const fileExt = file.name.split('.').pop() || 'jpg';
		const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;

		const { data: userData } = await supabase.auth.getUser();
		if (!userData.user) {
			uploadError = 'You must be logged in to upload.';
			uploading = false;
			target.value = '';
			return;
		}

		const filePath = `${userData.user.id}/${fileName}`;
		const { error: upErr } = await supabase.storage.from('tour-review-images').upload(filePath, file);

		if (upErr) {
			uploadError = upErr.message;
			uploading = false;
			target.value = '';
			return;
		}

		const { data: urlData } = supabase.storage.from('tour-review-images').getPublicUrl(filePath);
		imageUrl = urlData.publicUrl;
		uploading = false;
		target.value = '';
	}

	function clearReviewImage() {
		imageUrl = '';
		uploadError = null;
	}

	function fmtDate(ymd: string) {
		return new Date(ymd + 'T12:00:00').toLocaleDateString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<article class="review-prompt">
	<div class="review-prompt__recap">
		<a href={resolve('/tours/[id]', { id: tour.id })} class="review-prompt__media">
			<img
				src={tour.image_url ||
					'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=320&q=80'}
				alt=""
				loading="lazy"
			/>
		</a>
		<div class="review-prompt__meta">
			<h3 class="review-prompt__title">
				<a href={resolve('/tours/[id]', { id: tour.id })}>{tour.title}</a>
			</h3>
			<p class="review-prompt__dates">
				<span class="material-symbols-outlined" aria-hidden="true">calendar_today</span>
				{fmtDate(tour.start_date)}
				{#if tour.end_date && tour.end_date > tour.start_date}
					<span class="review-prompt__dash">→</span>
					{fmtDate(tour.end_date)}
				{/if}
				{#if tour.start_time}
					<span class="review-prompt__time">· {tour.start_time.slice(0, 5)}</span>
				{/if}
			</p>
			{#if tour.locality}
				<p class="review-prompt__place">
					<span class="material-symbols-outlined" aria-hidden="true">location_on</span>
					{tour.locality}
				</p>
			{/if}
		</div>
	</div>

	<div class="review-prompt__forms">
		<form
			method="POST"
			action="?/submitTourReview"
			class="review-prompt__form"
			use:enhance={() =>
				async ({ result, update }) => {
					await update({ reset: true });
					if (result.type === 'success') {
						imageUrl = '';
						uploadError = null;
					}
				}}
		>
			<input type="hidden" name="tour_id" value={tour.id} />
			<input type="hidden" name="image_url" value={imageUrl} />

			<fieldset class="review-prompt__field">
				<legend>Nature / beauty</legend>
				<p class="review-prompt__hint">Insta-worthy (5) or dull and gray (1)?</p>
				<div class="review-prompt__stars" role="radiogroup" aria-label="Nature and beauty rating">
					{#each [1, 2, 3, 4, 5] as n (n)}
						<label class="review-prompt__star-label">
							<input type="radio" name="rating_nature" value={n} required={n === 1} />
							<span class="sr-only">{n} out of 5</span>
							<span class="material-symbols-outlined review-prompt__star" aria-hidden="true">star</span>
						</label>
					{/each}
				</div>
				<div class="review-prompt__scale">
					<span>Gray</span><span>Gorgeous</span>
				</div>
			</fieldset>

			<fieldset class="review-prompt__field">
				<legend>Access / facilities</legend>
				<p class="review-prompt__hint">Sauna, bath, good access (5) or muddy field (1)?</p>
				<div class="review-prompt__stars" role="radiogroup" aria-label="Access and facilities rating">
					{#each [1, 2, 3, 4, 5] as n (n)}
						<label class="review-prompt__star-label">
							<input type="radio" name="rating_access" value={n} required={n === 1} />
							<span class="sr-only">{n} out of 5</span>
							<span class="material-symbols-outlined review-prompt__star" aria-hidden="true">star</span>
						</label>
					{/each}
				</div>
				<div class="review-prompt__scale">
					<span>Rough</span><span>Top notch</span>
				</div>
			</fieldset>

			<fieldset class="review-prompt__field">
				<legend>Hosts / guides / safety</legend>
				<p class="review-prompt__hint">Welcome and safe (5) or lost at sea (1)?</p>
				<div class="review-prompt__stars" role="radiogroup" aria-label="Hosts guides safety rating">
					{#each [1, 2, 3, 4, 5] as n (n)}
						<label class="review-prompt__star-label">
							<input type="radio" name="rating_hosts" value={n} required={n === 1} />
							<span class="sr-only">{n} out of 5</span>
							<span class="material-symbols-outlined review-prompt__star" aria-hidden="true">star</span>
						</label>
					{/each}
				</div>
				<div class="review-prompt__scale">
					<span>Shaky</span><span>Stellar</span>
				</div>
			</fieldset>

			<div class="review-prompt__field review-prompt__field--text">
				<label for="comment-{tour.id}">Any suggestions or comments?</label>
				<textarea
					id="comment-{tour.id}"
					name="comment"
					rows="3"
					maxlength="2000"
					placeholder="Optional — what should the next paddlers know?"
				></textarea>
			</div>

			<fieldset class="review-prompt__field review-prompt__field--upload">
				<legend>Trip photo <span class="review-prompt__optional">(optional)</span></legend>
				<p class="review-prompt__hint">Add a picture from your paddle — shown only within the visibility you choose below.</p>
				<div class="review-prompt__upload-row">
					<label class="review-prompt__file-label">
						<input
							type="file"
							accept="image/*"
							class="review-prompt__file"
							disabled={uploading}
							onchange={handleReviewImageUpload}
						/>
						<span class="review-prompt__file-btn">
							{uploading ? 'Uploading…' : 'Choose image'}
						</span>
					</label>
					{#if imageUrl}
						<button type="button" class="review-prompt__clear-photo" onclick={clearReviewImage}>
							Remove
						</button>
					{/if}
				</div>
				{#if uploadError}
					<p class="review-prompt__upload-err" role="alert">{uploadError}</p>
				{/if}
				{#if imageUrl}
					<div class="review-prompt__preview">
						<img src={imageUrl} alt="" />
					</div>
				{/if}
			</fieldset>

			<fieldset class="review-prompt__field">
				<legend>Review is visible to</legend>
				<p class="review-prompt__hint">Choose who can see your ratings, comment, and photo.</p>
				<div class="review-prompt__vis" role="radiogroup" aria-label="Review visibility">
					<!-- Default (1) first so native form reset keeps the intended default -->
					<label class="review-prompt__vis-opt">
						<input type="radio" name="visibility" value="1" checked />
						<span class="review-prompt__vis-card">
							<span class="review-prompt__vis-title">Host &amp; participants</span>
							<span class="review-prompt__vis-desc">Everyone who joined this tour can read it — not on the public homepage.</span>
						</span>
					</label>
					<label class="review-prompt__vis-opt">
						<input type="radio" name="visibility" value="0" />
						<span class="review-prompt__vis-card">
							<span class="review-prompt__vis-title">Host only</span>
							<span class="review-prompt__vis-desc">Organizer sees your feedback; not shared with participants or the site.</span>
						</span>
					</label>
					<label class="review-prompt__vis-opt">
						<input type="radio" name="visibility" value="2" />
						<span class="review-prompt__vis-card">
							<span class="review-prompt__vis-title">Everybody on Sup Tours</span>
							<span class="review-prompt__vis-desc">May appear on the home page and anywhere we show community reviews.</span>
						</span>
					</label>
				</div>
			</fieldset>

			<div class="review-prompt__actions">
				<button type="submit" class="review-prompt__submit">Submit review</button>
			</div>
		</form>

		<form
			method="POST"
			action="?/declineTourReview"
			class="review-prompt__decline-wrap"
			use:enhance={() =>
				async ({ update }) => {
					await update({ reset: true });
				}}
		>
			<input type="hidden" name="tour_id" value={tour.id} />
			<button type="submit" class="review-prompt__decline">Don’t ask again for this trip</button>
		</form>
	</div>
</article>

<style>
	.review-prompt {
		background: linear-gradient(145deg, var(--color-surface) 0%, var(--color-bg-muted) 100%);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius-lg);
		padding: 1.25rem;
		box-shadow: var(--shadow-card);
		margin-bottom: 1.25rem;
	}

	.review-prompt__recap {
		display: flex;
		gap: 1rem;
		margin-bottom: 1.25rem;
		padding-bottom: 1.25rem;
		border-bottom: var(--border-width) solid var(--color-border);
	}

	.review-prompt__media {
		flex-shrink: 0;
		width: 6.5rem;
		height: 6.5rem;
		border-radius: var(--border-radius);
		overflow: hidden;
		align-self: flex-start;
	}

	.review-prompt__media img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.review-prompt__meta {
		min-width: 0;
		flex: 1;
	}

	.review-prompt__title {
		margin: 0 0 0.35rem;
		font-size: var(--font-size-lg);
		font-weight: 700;
		line-height: var(--line-height-tight);
	}

	.review-prompt__title a {
		color: var(--color-text);
		text-decoration: none;
	}

	.review-prompt__title a:hover {
		color: var(--color-primary);
	}

	.review-prompt__dates,
	.review-prompt__place {
		margin: 0.25rem 0 0;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.25rem;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.review-prompt__dates .material-symbols-outlined,
	.review-prompt__place .material-symbols-outlined {
		font-size: 18px;
		opacity: 0.85;
	}

	.review-prompt__dash {
		margin: 0 0.15rem;
		opacity: 0.6;
	}

	.review-prompt__time {
		font-weight: 500;
	}

	.review-prompt__field {
		border: none;
		margin: 0 0 1.1rem;
		padding: 0;
	}

	.review-prompt__field legend {
		font-size: var(--font-size-sm);
		font-weight: 700;
		color: var(--color-text);
		padding: 0;
		margin-bottom: 0.2rem;
	}

	.review-prompt__hint {
		margin: 0 0 0.5rem;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		line-height: 1.4;
	}

	.review-prompt__stars {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.review-prompt__star-label {
		position: relative;
		cursor: pointer;
		margin: 0;
	}

	.review-prompt__star-label input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}

	.review-prompt__star {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: var(--border-radius);
		border: var(--border-width) solid var(--color-border);
		background: var(--color-bg);
		font-size: var(--font-size-xs);
		font-weight: 700;
		color: var(--color-text-muted);
		transition:
			background var(--transition-fast),
			border-color var(--transition-fast),
			color var(--transition-fast),
			box-shadow var(--transition-fast);
	}

	.review-prompt__star-label:hover .review-prompt__star {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.review-prompt__star-label:has(input:checked) .review-prompt__star {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
		font-variation-settings: 'FILL' 1;
		box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-primary-light);
	}

	.review-prompt__star-label:has(input:focus-visible) .review-prompt__star {
		box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-primary-light);
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

	.review-prompt__scale {
		display: flex;
		justify-content: space-between;
		margin-top: 0.35rem;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.review-prompt__field--text label {
		display: block;
		font-size: var(--font-size-sm);
		font-weight: 600;
		margin-bottom: 0.35rem;
	}

	.review-prompt__field--text textarea {
		width: 100%;
		padding: 0.6rem 0.75rem;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
		font: inherit;
		font-size: var(--font-size-sm);
		background: var(--color-bg);
		resize: vertical;
		min-height: 4rem;
	}

	.review-prompt__field--text textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.review-prompt__optional {
		font-weight: 400;
		color: var(--color-text-muted);
	}

	.review-prompt__field--upload {
		margin-bottom: 1rem;
	}

	.review-prompt__upload-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.35rem;
	}

	.review-prompt__file {
		position: absolute;
		width: 0.01px;
		height: 0.01px;
		opacity: 0;
		overflow: hidden;
	}

	.review-prompt__file-label {
		cursor: pointer;
		margin: 0;
	}

	.review-prompt__file-btn {
		display: inline-block;
		padding: 0.45rem 0.9rem;
		border-radius: var(--border-radius-full);
		border: var(--border-width) solid var(--color-border);
		background: var(--color-bg);
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text);
		transition:
			border-color var(--transition-fast),
			background var(--transition-fast);
	}

	.review-prompt__file-label:hover .review-prompt__file-btn {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.review-prompt__file:focus-visible + .review-prompt__file-btn {
		box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-primary-light);
	}

	.review-prompt__clear-photo {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.review-prompt__clear-photo:hover {
		color: var(--color-error);
	}

	.review-prompt__upload-err {
		margin: 0.5rem 0 0;
		font-size: var(--font-size-xs);
		color: var(--color-error);
	}

	.review-prompt__preview {
		margin-top: 0.75rem;
		max-width: 14rem;
		border-radius: var(--border-radius);
		overflow: hidden;
		border: var(--border-width) solid var(--color-border);
	}

	.review-prompt__preview img {
		display: block;
		width: 100%;
		height: auto;
	}

	.review-prompt__vis {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.35rem;
	}

	.review-prompt__vis-opt {
		display: block;
		margin: 0;
		cursor: pointer;
	}

	.review-prompt__vis-opt input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}

	.review-prompt__vis-card {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.65rem 0.85rem;
		border-radius: var(--border-radius);
		border: var(--border-width) solid var(--color-border);
		background: var(--color-bg);
		transition:
			border-color var(--transition-fast),
			box-shadow var(--transition-fast),
			background var(--transition-fast);
	}

	.review-prompt__vis-opt:hover .review-prompt__vis-card {
		border-color: var(--color-primary-light);
	}

	.review-prompt__vis-opt:has(input:checked) .review-prompt__vis-card {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg));
		box-shadow: 0 0 0 1px var(--color-primary);
	}

	.review-prompt__vis-opt:has(input:focus-visible) .review-prompt__vis-card {
		box-shadow: 0 0 0 2px var(--color-primary-light);
	}

	.review-prompt__vis-title {
		font-size: var(--font-size-sm);
		font-weight: 700;
		color: var(--color-text);
	}

	.review-prompt__vis-desc {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		line-height: 1.45;
	}

	.review-prompt__actions {
		margin-top: 0.5rem;
	}

	.review-prompt__submit {
		padding: 0.55rem 1.25rem;
		border: none;
		border-radius: var(--border-radius-full);
		background: var(--color-primary);
		color: white;
		font: inherit;
		font-weight: 600;
		font-size: var(--font-size-sm);
		cursor: pointer;
		transition: filter var(--transition-fast);
	}

	.review-prompt__submit:hover {
		filter: brightness(1.05);
	}

	.review-prompt__decline-wrap {
		margin: 0;
		padding-top: 0.75rem;
		border-top: var(--border-width) dashed var(--color-border);
	}

	.review-prompt__decline {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.review-prompt__decline:hover {
		color: var(--color-text);
	}
</style>
