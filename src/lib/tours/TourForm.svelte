<script lang="ts">
	import { enhance } from '$app/forms';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import type { Tour } from './dateGrouping';

	let { 
		tour = null, 
		form = null,
		action = '?/create'
	}: { 
		tour?: Tour | null; 
		form?: any;
		action?: string;
	} = $props();

	let step = $state(1);
	const totalSteps = 5;

	let title = $state('');
	let description = $state('');
	let selectedTags = $state<string[]>([]);
	let startDate = $state('');
	let startTime = $state('');
	let endDate = $state('');
	let locality = $state('');
	let parkingInfo = $state('');
	let maxParticipants = $state('');
	let ageMin = $state('0');
	let ageMax = $state('120');
	let securityNotes = $state('');
	let responsiblePerson = $state('');
	let contactInfo = $state('');
	let imageUrl = $state('');

	let syncedTourKey = $state<string | null>(null);
	$effect.pre(() => {
		const key = tour?.id ?? 'new';
		if (syncedTourKey === key) return;
		syncedTourKey = key;
		title = tour?.title ?? '';
		description = tour?.description ?? '';
		selectedTags = [...(tour?.tags ?? [])];
		startDate = tour?.start_date ?? '';
		startTime = tour?.start_time ?? '';
		endDate = tour?.end_date ?? '';
		locality = tour?.locality ?? '';
		parkingInfo = tour?.parking_info ?? '';
		maxParticipants = tour?.max_participants?.toString() ?? '';
		ageMin = tour?.age_min?.toString() ?? '0';
		ageMax = tour?.age_max?.toString() ?? '120';
		securityNotes = tour?.security_notes ?? '';
		responsiblePerson = tour?.responsible_person ?? '';
		contactInfo = tour?.contact_info ?? '';
		imageUrl = tour?.image_url ?? '';
	});

	// Image upload state
	let uploading = $state(false);
	let uploadError = $state<string | null>(null);

	// Form submit state
	let submitting = $state(false);
	const supabase = createSupabaseBrowserClient();

	const availableTags = [
		'social', 'beginner', 'adventure', 'family', 'race',
		'expert', 'waves', 'yoga', 'camping', 'sunset',
		'sunrise', 'nature', 'city', 'fishing', 'photography'
	];

	function toggleTag(tag: string) {
		if (selectedTags.includes(tag)) {
			selectedTags = selectedTags.filter(t => t !== tag);
		} else {
			selectedTags = [...selectedTags, tag];
		}
	}

	async function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;

		uploading = true;
		uploadError = null;

		const file = target.files[0];
		const fileExt = file.name.split('.').pop();
		const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
		
		const { data: userData } = await supabase.auth.getUser();
		if (!userData.user) {
			uploadError = "You must be logged in to upload images.";
			uploading = false;
			return;
		}

		const filePath = `${userData.user.id}/${fileName}`;

		const { error: uploadErrorData, data } = await supabase.storage
			.from('tour-images')
			.upload(filePath, file);

		if (uploadErrorData) {
			uploadError = uploadErrorData.message;
			uploading = false;
			return;
		}

		const { data: urlData } = supabase.storage
			.from('tour-images')
			.getPublicUrl(filePath);

		imageUrl = urlData.publicUrl;
		uploading = false;
	}

	function nextStep() {
		if (step < totalSteps) step++;
	}

	function prevStep() {
		if (step > 1) step--;
	}

	const canProceed = $derived(
		step === 1 ? title.trim().length > 0 :
		step === 2 ? startDate.length > 0 :
		true
	);

	const stepLabels = ['Basics', 'When', 'Where', 'Details', 'Review'];
</script>

<div class="wizard">
	<header class="wizard__header">
		<h1 class="wizard__title">{tour ? 'Edit Your Tour' : 'Create Your Tour'}</h1>
		<p class="wizard__subtitle">Share your favorite SUP spots with the world</p>
	</header>

	<!-- Progress bar -->
	<div class="wizard__progress">
		{#each stepLabels as label, i (label)}
			<div class="wizard__step" class:wizard__step--active={step === i + 1} class:wizard__step--done={step > i + 1}>
				<div class="wizard__step-dot">
					{#if step > i + 1}
						<span class="material-symbols-outlined" style="font-size:16px">check</span>
					{:else}
						{i + 1}
					{/if}
				</div>
				<span class="wizard__step-label">{label}</span>
			</div>
		{/each}
		<div class="wizard__progress-bar">
			<div class="wizard__progress-fill" style="width: {((step - 1) / (totalSteps - 1)) * 100}%"></div>
		</div>
	</div>

	<form method="POST" {action} use:enhance={() => {
		submitting = true;
		return async ({ result, update }) => {
			submitting = false;
			if (result.type === 'failure') {
				console.error('[TourForm] Submit error:', result.data?.message, result);
			}
			await update();
		};
	}} class="wizard__form">
		<!-- Hidden fields for all data -->
		<input type="hidden" name="title" value={title} />
		<input type="hidden" name="description" value={description} />
		{#each selectedTags as tag (tag)}
			<input type="hidden" name="tags" value={tag} />
		{/each}
		<input type="hidden" name="start_date" value={startDate} />
		<input type="hidden" name="start_time" value={startTime} />
		<input type="hidden" name="end_date" value={endDate} />
		<input type="hidden" name="locality" value={locality} />
		<input type="hidden" name="parking_info" value={parkingInfo} />
		<input type="hidden" name="max_participants" value={maxParticipants} />
		<input type="hidden" name="age_min" value={ageMin} />
		<input type="hidden" name="age_max" value={ageMax} />
		<input type="hidden" name="security_notes" value={securityNotes} />
		<input type="hidden" name="responsible_person" value={responsiblePerson} />
		<input type="hidden" name="contact_info" value={contactInfo} />
		<input type="hidden" name="image_url" value={imageUrl} />

		<!-- Step 1: Basics -->
		{#if step === 1}
			<div class="wizard__panel">
				<h2 class="wizard__panel-title">What's your tour about?</h2>

				<label class="wizard__label" for="title">Tour name *</label>
				<input
					id="title"
					type="text"
					bind:value={title}
					placeholder="e.g. Sunset Paddle at Amager Strand"
					class="wizard__input"
					required
				/>

				<label class="wizard__label" for="description">Description</label>
				<textarea
					id="description"
					bind:value={description}
					placeholder="Tell people what to expect..."
					class="wizard__textarea"
					rows="4"
				></textarea>

				<fieldset class="wizard__tag-group">
					<legend class="wizard__label">Tour type tags</legend>
					<div class="wizard__tags">
						{#each availableTags as tag (tag)}
							<button
								type="button"
								class="wizard__tag"
								class:wizard__tag--selected={selectedTags.includes(tag)}
								onclick={() => toggleTag(tag)}
							>
								{tag}
							</button>
						{/each}
					</div>
				</fieldset>

				<label class="wizard__label" for="image_file">Tour Image</label>
				<div class="wizard__image-upload">
					{#if imageUrl}
						<div class="wizard__image-preview">
							<img src={imageUrl} alt="Tour preview" />
							<button type="button" class="wizard__image-remove" onclick={() => imageUrl = ''}>
								<span class="material-symbols-outlined">close</span>
							</button>
						</div>
					{:else}
						<div class="wizard__file-input-wrap">
							<input
								id="image_file"
								type="file"
								accept="image/*"
								onchange={handleFileUpload}
								disabled={uploading}
								class="wizard__file-input"
							/>
							<div class="wizard__file-dummy">
								<span class="material-symbols-outlined">cloud_upload</span>
								{uploading ? 'Uploading...' : 'Click to upload image'}
							</div>
						</div>
					{/if}
				</div>
				{#if uploadError}
					<p class="wizard__error">{uploadError}</p>
				{/if}
				
				<label class="wizard__label" for="image_url">Or provide image URL</label>
				<input
					id="image_url"
					type="url"
					bind:value={imageUrl}
					placeholder="https://..."
					class="wizard__input"
				/>
			</div>
		{/if}

		<!-- Step 2: When -->
		{#if step === 2}
			<div class="wizard__panel">
				<h2 class="wizard__panel-title">When is it happening?</h2>

				<label class="wizard__label" for="start_date">Start date *</label>
				<input
					id="start_date"
					type="date"
					bind:value={startDate}
					class="wizard__input"
					required
				/>

				<label class="wizard__label" for="start_time">Start time</label>
				<input
					id="start_time"
					type="time"
					bind:value={startTime}
					class="wizard__input"
				/>

				<label class="wizard__label" for="end_date">End date (for multi-day trips)</label>
				<input
					id="end_date"
					type="date"
					bind:value={endDate}
					class="wizard__input"
				/>
			</div>
		{/if}

		<!-- Step 3: Where -->
		{#if step === 3}
			<div class="wizard__panel">
				<h2 class="wizard__panel-title">Where are you paddling?</h2>

				<label class="wizard__label" for="locality">Location / meeting point</label>
				<input
					id="locality"
					type="text"
					bind:value={locality}
					placeholder="e.g. Amager Strandpark, Copenhagen"
					class="wizard__input"
				/>

				<label class="wizard__label" for="parking_info">Parking info</label>
				<textarea
					id="parking_info"
					bind:value={parkingInfo}
					placeholder="Where to park, public transport options..."
					class="wizard__textarea"
					rows="3"
				></textarea>
			</div>
		{/if}

		<!-- Step 4: Details -->
		{#if step === 4}
			<div class="wizard__panel">
				<h2 class="wizard__panel-title">Tour details</h2>

				<div class="wizard__row">
					<div class="wizard__field">
						<label class="wizard__label" for="max_participants">Max participants</label>
						<input
							id="max_participants"
							type="number"
							bind:value={maxParticipants}
							min="1"
							max="500"
							placeholder="e.g. 20"
							class="wizard__input"
						/>
					</div>
				</div>

				<div class="wizard__row">
					<div class="wizard__field">
						<label class="wizard__label" for="age_min">Min age</label>
						<input
							id="age_min"
							type="number"
							bind:value={ageMin}
							min="0"
							max="120"
							class="wizard__input"
						/>
					</div>
					<div class="wizard__field">
						<label class="wizard__label" for="age_max">Max age</label>
						<input
							id="age_max"
							type="number"
							bind:value={ageMax}
							min="0"
							max="120"
							class="wizard__input"
						/>
					</div>
				</div>

				<label class="wizard__label" for="security_notes">Safety & security notes</label>
				<textarea
					id="security_notes"
					bind:value={securityNotes}
					placeholder="Life jackets required, swimming ability, weather conditions..."
					class="wizard__textarea"
					rows="3"
				></textarea>

				<label class="wizard__label" for="responsible_person">Responsible person</label>
				<input
					id="responsible_person"
					type="text"
					bind:value={responsiblePerson}
					placeholder="Name of the tour leader"
					class="wizard__input"
				/>

				<label class="wizard__label" for="contact_info">Contact info</label>
				<input
					id="contact_info"
					type="text"
					bind:value={contactInfo}
					placeholder="Phone, email, or social media"
					class="wizard__input"
				/>
			</div>
		{/if}

		<!-- Step 5: Review -->
		{#if step === 5}
			<div class="wizard__panel">
				<h2 class="wizard__panel-title">Review your tour</h2>

				<div class="wizard__review">
					<div class="wizard__review-item">
						<strong>Title:</strong> {title || '—'}
					</div>
					{#if description}
						<div class="wizard__review-item">
							<strong>Description:</strong> {description}
						</div>
					{/if}
					<div class="wizard__review-item">
						<strong>Date:</strong> {startDate}{startTime ? ` at ${startTime}` : ''}
						{endDate ? ` — ${endDate}` : ''}
					</div>
					{#if locality}
						<div class="wizard__review-item">
							<strong>Location:</strong> {locality}
						</div>
					{/if}
					{#if selectedTags.length > 0}
						<div class="wizard__review-item">
							<strong>Tags:</strong> {selectedTags.join(', ')}
						</div>
					{/if}
					{#if maxParticipants}
						<div class="wizard__review-item">
							<strong>Max participants:</strong> {maxParticipants}
						</div>
					{/if}
					<div class="wizard__review-item">
						<strong>Age range:</strong> {ageMin}–{ageMax}
					</div>
					{#if responsiblePerson}
						<div class="wizard__review-item">
							<strong>Responsible:</strong> {responsiblePerson}
						</div>
					{/if}
				</div>

				{#if form?.message}
					<p class="wizard__error">{form.message}</p>
				{/if}
			</div>
		{/if}

		<!-- Navigation -->
		<div class="wizard__nav">
			{#if step > 1}
				<button type="button" class="wizard__btn wizard__btn--back" onclick={prevStep}>
					<span class="material-symbols-outlined">arrow_back</span>
					Back
				</button>
			{:else}
				<div></div>
			{/if}

			{#if step < totalSteps}
				<button
					type="button"
					class="wizard__btn wizard__btn--next"
					onclick={nextStep}
					disabled={!canProceed || uploading}
				>
					Next
					<span class="material-symbols-outlined">arrow_forward</span>
				</button>
			{:else}
				<div class="wizard__submit-group">
					<button type="submit" name="action" value="draft" class="wizard__btn wizard__btn--draft" disabled={uploading || submitting}>
						{#if submitting}
							<span class="wizard__spinner"></span>
							Saving...
						{:else}
							Save Draft
						{/if}
					</button>
					<button type="submit" name="action" value="publish" class="wizard__btn wizard__btn--publish" disabled={uploading || submitting}>
						{#if submitting}
							<span class="wizard__spinner"></span>
							{tour ? 'Updating...' : 'Publishing...'}
						{:else}
							<span class="material-symbols-outlined">rocket_launch</span>
							{tour ? 'Update Tour' : 'Publish!'}
						{/if}
					</button>
				</div>
			{/if}
		</div>
	</form>
</div>

<style>
	.wizard {
		max-width: 36rem;
		margin: 0 auto;
		padding: 1.5rem 1.25rem 4rem;
	}

	.wizard__header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.wizard__title {
		margin: 0;
		font-size: var(--font-size-2xl);
		font-weight: 700;
	}

	.wizard__subtitle {
		margin: 0.25rem 0 0;
		color: var(--color-text-muted);
	}

	/* Progress */
	.wizard__progress {
		display: flex;
		justify-content: space-between;
		position: relative;
		margin-bottom: 2rem;
		padding: 0 0.5rem;
	}

	.wizard__progress-bar {
		position: absolute;
		top: 1rem;
		left: 1.5rem;
		right: 1.5rem;
		height: 2px;
		background: var(--color-border);
		z-index: 0;
	}

	.wizard__progress-fill {
		height: 100%;
		background: var(--color-primary);
		transition: width var(--transition-normal);
	}

	.wizard__step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		z-index: 1;
	}

	.wizard__step-dot {
		width: 2rem;
		height: 2rem;
		border-radius: var(--border-radius-full);
		background: var(--color-surface);
		border: 2px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--font-size-xs);
		font-weight: 700;
		color: var(--color-text-muted);
		transition: all var(--transition-fast);
	}

	.wizard__step--active .wizard__step-dot {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	.wizard__step--done .wizard__step-dot {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	.wizard__step-label {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.wizard__step--active .wizard__step-label {
		color: var(--color-primary);
		font-weight: 700;
	}

	/* Panel */
	.wizard__panel {
		background: var(--color-surface);
		border-radius: var(--border-radius-lg);
		padding: 1.5rem;
		box-shadow: var(--shadow-card);
		margin-bottom: 1.5rem;
	}

	.wizard__panel-title {
		margin: 0 0 1.25rem;
		font-size: var(--font-size-xl);
		font-weight: 700;
	}

	.wizard__label {
		display: block;
		font-size: var(--font-size-sm);
		font-weight: 600;
		margin-bottom: 0.35rem;
		margin-top: 1rem;
		color: var(--color-text);
	}

	.wizard__label:first-of-type {
		margin-top: 0;
	}

	.wizard__input,
	.wizard__textarea {
		width: 100%;
		padding: 0.6rem 0.75rem;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
		font: inherit;
		font-size: var(--font-size-sm);
		background: var(--color-bg);
		transition: border-color var(--transition-fast);
	}

	.wizard__input:focus,
	.wizard__textarea:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px rgba(19, 200, 236, 0.15);
	}

	.wizard__textarea {
		resize: vertical;
	}

	.wizard__row {
		display: flex;
		gap: 1rem;
	}

	.wizard__field {
		flex: 1;
	}

	/* Tags */
	.wizard__tag-group {
		border: none;
		margin: 1rem 0 0;
		padding: 0;
		min-width: 0;
	}

	.wizard__tag-group .wizard__label {
		margin-top: 0;
	}

	.wizard__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.wizard__tag {
		padding: 0.35rem 0.75rem;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius-full);
		background: var(--color-surface);
		font-size: var(--font-size-xs);
		font-weight: 600;
		text-transform: capitalize;
		cursor: pointer;
		transition: all var(--transition-fast);
		color: var(--color-text-muted);
	}

	.wizard__tag:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.wizard__tag--selected {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	/* Review */
	.wizard__review {
		display: grid;
		gap: 0.5rem;
	}

	.wizard__review-item {
		padding: 0.5rem 0;
		border-bottom: var(--border-width) solid var(--color-border-light);
		font-size: var(--font-size-sm);
	}

	.wizard__review-item:last-child {
		border-bottom: none;
	}

	.wizard__error {
		color: var(--color-error);
		margin: 0.75rem 0 0;
		font-size: var(--font-size-sm);
	}

	/* Navigation */
	.wizard__nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.wizard__btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.6rem 1.25rem;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius-full);
		background: var(--color-surface);
		font: inherit;
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.wizard__btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.wizard__spinner {
		display: inline-block;
		width: 0.9rem;
		height: 0.9rem;
		border: 2px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: wizard-spin 0.7s linear infinite;
		flex-shrink: 0;
	}

	@keyframes wizard-spin {
		to { transform: rotate(360deg); }
	}

	.wizard__btn--back {
		color: var(--color-text-muted);
	}

	.wizard__btn--back:hover {
		background: var(--color-bg-muted);
	}

	.wizard__btn--next {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}

	.wizard__btn--next:hover:not(:disabled) {
		background: var(--color-primary-dark);
	}

	.wizard__submit-group {
		display: flex;
		gap: 0.75rem;
	}

	.wizard__btn--draft {
		color: var(--color-text-muted);
	}

	.wizard__btn--draft:hover {
		background: var(--color-bg-muted);
	}

	.wizard__btn--publish {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
		box-shadow: var(--shadow-primary);
	}

	.wizard__btn--publish:hover {
		background: var(--color-primary-dark);
	}

	.wizard__form {
		display: block;
	}

	/* Image Upload Styles */
	.wizard__image-upload {
		margin-top: 0.5rem;
	}

	.wizard__file-input-wrap {
		position: relative;
		height: 8rem;
		border: 2px dashed var(--color-border);
		border-radius: var(--border-radius-lg);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		transition: border-color var(--transition-fast);
	}

	.wizard__file-input-wrap:hover {
		border-color: var(--color-primary);
	}

	.wizard__file-input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		z-index: 2;
	}

	.wizard__file-dummy {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		color: var(--color-text-muted);
		pointer-events: none;
	}

	.wizard__file-dummy .material-symbols-outlined {
		font-size: 32px;
	}

	.wizard__image-preview {
		position: relative;
		height: 12rem;
		border-radius: var(--border-radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-sm);
	}

	.wizard__image-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.wizard__image-remove {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 2rem;
		height: 2rem;
		border-radius: var(--border-radius-full);
		background: rgba(0, 0, 0, 0.5);
		color: white;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.wizard__image-remove:hover {
		background: rgba(0, 0, 0, 0.7);
	}
</style>
