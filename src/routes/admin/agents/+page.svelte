<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		loadStoredAiPrefs,
		saveStoredAiPrefs,
		resolvedModelLabel,
		type StoredAiPrefs,
	} from '$lib/admin/aiPreferences';
	import { MODEL_BY_PROVIDER_TIER, type AiProvider, type AiTier } from '$lib/scraper/aiScraperConfig';

	let { data } = $props();

	let provider = $state<AiProvider>('gemini');
	let tier = $state<AiTier>('fast');
	/** Empty string = brug tier; ellers konkret model-id */
	let explicitModel = $state('');

	function modelsForProvider(p: AiProvider): { id: string; label: string }[] {
		if (p === 'gemini') {
			return [
				{ id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (preview, hurtig)' },
				{ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
				{ id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
				{ id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
			];
		}
		return [
			{ id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (hurtig)' },
			{ id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4 (pro)' },
		];
	}

	function currentPrefs(): StoredAiPrefs {
		const model = explicitModel.trim() || undefined;
		return { provider, tier, model };
	}

	function persist() {
		saveStoredAiPrefs(currentPrefs());
	}

	function setProvider(p: AiProvider) {
		provider = p;
		const allowed = new Set(modelsForProvider(p).map((m) => m.id));
		if (explicitModel && !allowed.has(explicitModel)) explicitModel = '';
		persist();
	}

	function setTier(t: AiTier) {
		tier = t;
		persist();
	}

	onMount(() => {
		const s = loadStoredAiPrefs();
		provider = s.provider;
		tier = s.tier;
		explicitModel = s.model ?? '';
	});

	const activeLabel = $derived(
		provider === 'gemini' ? 'Google Gemini' : 'Anthropic Claude',
	);

	const tierHint = $derived(
		tier === 'fast' ? 'Hurtig / lavere omkostning' : 'Mere grundig / kraftigere',
	);

	const modelPreview = $derived(resolvedModelLabel(currentPrefs()));

	const geminiOk = $derived(data.hasGeminiKey);
	const claudeOk = $derived(data.hasAnthropicKey);
	const selectedProviderOk = $derived(provider === 'gemini' ? geminiOk : claudeOk);
</script>

<svelte:head>
	<title>Agenter — Admin — SUP Tours</title>
</svelte:head>

<div class="agents">
	<div class="agents__header">
		<a href={resolve('/admin')} class="back-link">
			<span class="material-symbols-outlined">arrow_back</span>
			Admin
		</a>
		<h1>Agenter</h1>
		<p class="agents__sub">
			Vælg hvilken AI der bruges til admin-scraper (søgning og udtræk). Indstillinger gemmes kun i denne browser.
		</p>
	</div>

	<section class="card card--status" aria-labelledby="active-heading">
		<h2 id="active-heading">Aktiv agent</h2>
		<p class="active-line">
			<span class="badge badge--{provider}">{activeLabel}</span>
			<span class="muted">·</span>
			<span>{tierHint}</span>
		</p>
		<p class="mono-preview" title="Model-id sendes til serveren ved kørsel">
			Model: <code>{modelPreview}</code>
		</p>
		{#if !selectedProviderOk}
			<p class="warn" role="status">
				<span class="material-symbols-outlined">warning</span>
				Den valgte udbyder har ingen API-nøgle på serveren — scraper-kald vil fejle indtil miljøvariablen er sat.
			</p>
		{/if}
	</section>

	<section class="card" aria-labelledby="keys-heading">
		<h2 id="keys-heading">API-nøgler (server)</h2>
		<p class="hint">Vi viser ikke nøgler — kun om processen har indlæst dem fra miljøet.</p>
		<ul class="key-list">
			<li>
				<span class="key-name"><code>GEMINI_API_KEY</code></span>
				{#if geminiOk}
					<span class="pill pill--ok">Indlæst</span>
				{:else}
					<span class="pill pill--bad">Mangler</span>
				{/if}
			</li>
			<li>
				<span class="key-name"><code>ANTHROPIC_API_KEY</code></span>
				{#if claudeOk}
					<span class="pill pill--ok">Indlæst</span>
				{:else}
					<span class="pill pill--bad">Mangler</span>
				{/if}
			</li>
		</ul>
	</section>

	<section class="card" aria-labelledby="pick-heading">
		<h2 id="pick-heading">Vælg udbyder</h2>
		<div class="provider-grid">
			<button
				type="button"
				class="provider-tile"
				class:provider-tile--active={provider === 'gemini'}
				onclick={() => setProvider('gemini')}
			>
				<span class="provider-tile__title">Gemini</span>
				<span class="provider-tile__meta">Google · bl.a. 2.5 Flash</span>
			</button>
			<button
				type="button"
				class="provider-tile"
				class:provider-tile--active={provider === 'claude'}
				onclick={() => setProvider('claude')}
			>
				<span class="provider-tile__title">Claude</span>
				<span class="provider-tile__meta">Anthropic · Haiku / Sonnet</span>
			</button>
		</div>

		<h3 class="h3">Niveau</h3>
		<p class="hint">Styrer standardmodel hvis du ikke vælger en konkret model nedenfor.</p>
		<div class="tier-row">
			<button
				type="button"
				class="tier-btn"
				class:tier-btn--active={tier === 'fast'}
				onclick={() => setTier('fast')}
			>
				Hurtig / billig
				<small>{MODEL_BY_PROVIDER_TIER[provider].fast}</small>
			</button>
			<button
				type="button"
				class="tier-btn"
				class:tier-btn--active={tier === 'pro'}
				onclick={() => setTier('pro')}
			>
				Pro / mere tænkende
				<small>{MODEL_BY_PROVIDER_TIER[provider].pro}</small>
			</button>
		</div>

		<h3 class="h3">Konkret model (valgfri)</h3>
		<p class="hint">
			Vælg f.eks. <strong>Gemini 3 Flash (preview)</strong> fast, eller lad feltet stå på “Følg niveau” for at bruge tabellen ovenfor.
		</p>
		<label class="select-wrap">
			<span class="visually-hidden">Model</span>
			<select class="model-select" bind:value={explicitModel} onchange={persist}>
				<option value="">Følg niveau ({tier === 'fast' ? 'hurtig' : 'pro'})</option>
				{#each modelsForProvider(provider) as opt (opt.id)}
					<option value={opt.id}>{opt.label}</option>
				{/each}
			</select>
		</label>
	</section>

	<p class="footer-note">
		<a href={resolve('/admin/scraper')}>Event scraper</a> bruger disse valg automatisk ved “Kør søgning” og “Kør skraber”.
	</p>
</div>

<style>
	.agents {
		max-width: 640px;
		margin: 0 auto;
		padding: var(--section-padding);
	}

	.agents__header {
		margin-bottom: 1.5rem;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		text-decoration: none;
		margin-bottom: 0.75rem;
		transition: color var(--transition-fast);
	}
	.back-link:hover {
		color: var(--color-primary);
		text-decoration: none;
	}
	.back-link .material-symbols-outlined {
		font-size: 18px;
	}

	.agents__header h1 {
		margin: 0 0 0.25rem;
	}
	.agents__sub {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin: 0;
		line-height: 1.45;
	}

	.card {
		padding: 1.25rem;
		margin-bottom: 1.25rem;
		background: var(--color-surface);
		border: var(--border-width) solid var(--color-border-light);
		border-radius: var(--border-radius-lg);
	}

	.card h2 {
		margin: 0 0 0.75rem;
		font-size: 1.1rem;
	}
	.h3 {
		margin: 1.25rem 0 0.35rem;
		font-size: var(--font-size-sm);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.hint {
		margin: 0 0 0.75rem;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		line-height: 1.45;
	}

	.active-line {
		margin: 0 0 0.5rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		font-size: var(--font-size-sm);
	}

	.muted {
		color: var(--color-text-muted);
	}

	.mono-preview {
		margin: 0;
		font-size: var(--font-size-sm);
	}
	.mono-preview code {
		font-size: 0.85em;
		word-break: break-all;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.55rem;
		border-radius: var(--border-radius-full);
		font-size: var(--font-size-xs);
		font-weight: 700;
	}
	.badge--gemini {
		background: rgba(59, 130, 246, 0.12);
		color: #1d4ed8;
	}
	.badge--claude {
		background: rgba(217, 119, 6, 0.12);
		color: #b45309;
	}

	.warn {
		display: flex;
		align-items: flex-start;
		gap: 0.35rem;
		margin: 0.75rem 0 0;
		padding: 0.5rem 0.65rem;
		font-size: var(--font-size-sm);
		background: rgba(234, 179, 8, 0.12);
		color: #a16207;
		border-radius: var(--border-radius);
		line-height: 1.4;
	}
	.warn .material-symbols-outlined {
		font-size: 18px;
		flex-shrink: 0;
	}

	.key-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.key-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: var(--font-size-sm);
	}
	.key-name code {
		font-size: 0.85em;
	}

	.pill {
		font-size: var(--font-size-xs);
		font-weight: 600;
		padding: 0.15rem 0.5rem;
		border-radius: var(--border-radius-full);
	}
	.pill--ok {
		background: rgba(34, 197, 94, 0.12);
		color: #15803d;
	}
	.pill--bad {
		background: rgba(239, 68, 68, 0.1);
		color: #b91c1c;
	}

	.provider-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	@media (max-width: 480px) {
		.provider-grid {
			grid-template-columns: 1fr;
		}
	}

	.provider-tile {
		text-align: left;
		padding: 0.85rem 1rem;
		border-radius: var(--border-radius-lg);
		border: 2px solid var(--color-border-light);
		background: var(--color-bg, #fff);
		cursor: pointer;
		font: inherit;
		transition:
			border-color var(--transition-fast),
			background var(--transition-fast);
	}
	.provider-tile:hover {
		border-color: var(--color-primary);
	}
	.provider-tile--active {
		border-color: var(--color-primary);
		background: rgba(59, 130, 246, 0.06);
	}
	.provider-tile__title {
		display: block;
		font-weight: 700;
		margin-bottom: 0.2rem;
	}
	.provider-tile__meta {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.tier-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	@media (max-width: 480px) {
		.tier-row {
			grid-template-columns: 1fr;
		}
	}

	.tier-btn {
		text-align: left;
		padding: 0.75rem 1rem;
		border-radius: var(--border-radius);
		border: 2px solid var(--color-border-light);
		background: var(--color-bg, #fff);
		cursor: pointer;
		font: inherit;
		font-size: var(--font-size-sm);
		font-weight: 600;
		transition:
			border-color var(--transition-fast),
			background var(--transition-fast);
	}
	.tier-btn small {
		display: block;
		margin-top: 0.25rem;
		font-weight: 400;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-family: ui-monospace, monospace;
		word-break: break-all;
	}
	.tier-btn:hover {
		border-color: var(--color-primary);
	}
	.tier-btn--active {
		border-color: #7c3aed;
		background: rgba(124, 58, 237, 0.06);
	}

	.select-wrap {
		display: block;
	}
	.model-select {
		width: 100%;
		max-width: 100%;
		padding: 0.55rem 0.75rem;
		font: inherit;
		font-size: var(--font-size-sm);
		border-radius: var(--border-radius);
		border: var(--border-width) solid var(--color-border);
		background: var(--color-bg, #fff);
	}

	.visually-hidden {
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

	.footer-note {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}
	.footer-note a {
		color: var(--color-primary);
	}
</style>
