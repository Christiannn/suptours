<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { loadStoredAiPrefs, prefsToApiBody } from '$lib/admin/aiPreferences';

	let { data } = $props();
	let searching = $state(false);
	let extracting = $state(false);

	let searchResult = $state<{ ok: boolean; sourcesFound?: number; error?: string } | null>(null);
	let extractResult = $state<{ ok: boolean; draftsCreated?: number; error?: string } | null>(null);

	let searchTermsInput = $state(
		'SUP arrangementer Danmark 2025 2026, stand up paddleboard events Danmark race, SUP tour race DK kalender, paddle board stævne Danmark, SUP klub events Danmark'
	);
	let domainPatternsInput = $state('*.dk*, *facebook.dk*');
	let maxResults = $state(50);

	let selectedSourceUrl = $state<string | null>(null);
	let selectedSourceDomain = $state<string | null>(null);
	let extractionInstructions = $state(
		'Find kun reelle SUP tours/events. Returner 1 eller flere konkrete forslag, hvis de findes. Ignorer irrelevante sider.'
	);

	function toList(value: string): string[] {
		return value
			.split(',')
			.map((entry) => entry.trim())
			.filter(Boolean);
	}

	function fmtDate(d: string | null) {
		if (!d) return '—';
		return new Date(d).toLocaleDateString('da-DK', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		});
	}

	function fmtDateTime(d: string | null) {
		if (!d) return '—';
		return new Date(d).toLocaleString('da-DK', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	async function runSearch() {
		searching = true;
		searchResult = null;
		try {
			const body = {
				...prefsToApiBody(loadStoredAiPrefs()),
				searchQueries: toList(searchTermsInput),
				domainPatterns: toList(domainPatternsInput),
				maxResults: Math.max(1, Math.min(50, Number(maxResults || 50))),
			};
			const res = await fetch('/api/scraper/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			const json = await res.json();
			searchResult = res.ok
				? { ok: true, sourcesFound: json.sourcesFound }
				: { ok: false, error: json.message ?? 'Fejl' };
			if (res.ok) await invalidateAll();
		} catch (e) {
			searchResult = { ok: false, error: String(e) };
		} finally {
			searching = false;
		}
	}

	function selectSource(url: string, domain: string) {
		selectedSourceUrl = url;
		selectedSourceDomain = domain;
		extractResult = null;
	}

	async function runSingleExtract() {
		if (!selectedSourceUrl) return;
		extracting = true;
		extractResult = null;
		try {
			const res = await fetch('/api/scraper/extract', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...prefsToApiBody(loadStoredAiPrefs()),
					url: selectedSourceUrl,
					instructions: extractionInstructions,
				}),
			});
			const json = await res.json();
			extractResult = res.ok
				? { ok: true, draftsCreated: json.draftsCreated }
				: { ok: false, error: json.message ?? 'Fejl' };
			if (res.ok) await invalidateAll();
		} catch (e) {
			extractResult = { ok: false, error: String(e) };
		} finally {
			extracting = false;
		}
	}
</script>

<svelte:head>
	<title>Scraper Admin — SUP Tours</title>
</svelte:head>

<div class="scraper">
	<div class="scraper__header">
		<a href={resolve('/admin')} class="back-link">
			<span class="material-symbols-outlined">arrow_back</span>
			Admin
		</a>
		<h1>Event Scraper</h1>
		<p class="scraper__sub">
			{data.sources.length} kilder ·
			{data.drafts.length} kladder afventer godkendelse ·
			<a href={resolve('/admin/agents')}>AI-model</a>
		</p>
	</div>

	<section class="panel">
		<div class="panel__head">
			<h2>1) Search control</h2>
		</div>
		<div class="search-grid">
			<label class="field">
				<span>Søgetermer (komma-separeret)</span>
				<textarea bind:value={searchTermsInput} rows="3"></textarea>
			</label>
			<label class="field">
				<span>Domæne/endings filter (komma-separeret, wildcard *)</span>
				<input type="text" bind:value={domainPatternsInput} />
			</label>
			<label class="field field--sm">
				<span>Maks resultater</span>
				<input type="number" min="1" max="50" bind:value={maxResults} />
			</label>
		</div>
		<div class="panel__actions">
			<button class="btn-run" onclick={runSearch} disabled={searching || extracting}>
				{#if searching}<span class="spinner"></span>Søger…{:else}<span class="material-symbols-outlined">search</span>Kør søgning{/if}
			</button>
			{#if searchResult}
				<p class="status" class:status--ok={searchResult.ok} class:status--err={!searchResult.ok}>
					{#if searchResult.ok}
						<span class="material-symbols-outlined">check_circle</span>
						{searchResult.sourcesFound} nye/opdaterede kilder gemt
					{:else}
						<span class="material-symbols-outlined">error</span>
						{searchResult.error}
					{/if}
				</p>
			{/if}
		</div>
	</section>

	<section class="panel">
		<div class="panel__head">
			<h2>2) Kilder ({data.sources.length})</h2>
			<p>Når kilderne er gemt: vælg en kilde og klik “AI extract” manuelt.</p>
		</div>
		<div class="content-list">
			{#if data.sources.length === 0}
				<p class="empty">Ingen kilder endnu. Kør søgning ovenfor.</p>
			{:else}
				{#each data.sources as src (src.id)}
					<div
						class="row row--select"
						class:row--inactive={!src.is_active}
						class:row--selected={selectedSourceUrl === src.url}
						role="button"
						tabindex="0"
						onclick={() => selectSource(src.url, src.domain)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								selectSource(src.url, src.domain);
							}
						}}
					>
						<div class="row__main">
							<div class="row__title">
								{src.domain}
								{#if !src.is_active}<span class="badge badge--muted">inaktiv</span>{/if}
							</div>
							<p class="row__meta">
								Fundet: {fmtDate(src.last_searched_at)} · Sidst udtrukket: {fmtDate(src.last_scraped_at)}
							</p>
							<p class="row__url">{src.url}</p>
						</div>
						<div class="row__actions">
							<form method="POST" action="?/toggleSource" use:enhance>
								<input type="hidden" name="id" value={src.id} />
								<input type="hidden" name="is_active" value={String(src.is_active)} />
								<button type="submit" class="btn-icon" title={src.is_active ? 'Deaktiver' : 'Aktiver'}>
									<span class="material-symbols-outlined">{src.is_active ? 'pause_circle' : 'play_circle'}</span>
								</button>
							</form>
							<a href={src.url} target="_blank" rel="noopener" class="btn-icon" title="Åbn ekstern">
								<span class="material-symbols-outlined">open_in_new</span>
							</a>
							<form method="POST" action="?/deleteSource" use:enhance onsubmit={(e) => { if (!confirm(`Slet kilden "${src.domain}"?`)) e.preventDefault(); }}>
								<input type="hidden" name="id" value={src.id} />
								<button type="submit" class="btn-icon btn-icon--danger" title="Slet">
									<span class="material-symbols-outlined">delete</span>
								</button>
							</form>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</section>

	<section class="panel">
		<div class="panel__head">
			<h2>3) Preview + AI extraction</h2>
			<p>Vælg en kilde ovenfor. Siden vises her i iframe, og extraction kører kun for den valgte URL.</p>
		</div>
		{#if selectedSourceUrl}
			<div class="extract-toolbar">
				<div class="extract-toolbar__source">
					<strong>{selectedSourceDomain}</strong>
					<span>{selectedSourceUrl}</span>
				</div>
				<button class="btn-run btn-run--extract" onclick={runSingleExtract} disabled={extracting}>
					{#if extracting}<span class="spinner"></span>AI extract…{:else}<span class="material-symbols-outlined">bolt</span>AI extract SUP tour(s){/if}
				</button>
			</div>
			<label class="field">
				<span>Instructions (redigerbar)</span>
				<textarea bind:value={extractionInstructions} rows="3"></textarea>
			</label>
			{#if extractResult}
				<p class="status" class:status--ok={extractResult.ok} class:status--err={!extractResult.ok}>
					{#if extractResult.ok}
						<span class="material-symbols-outlined">check_circle</span>
						{extractResult.draftsCreated} draft(s) oprettet/opdateret for URL
					{:else}
						<span class="material-symbols-outlined">error</span>
						{extractResult.error}
					{/if}
				</p>
			{/if}
			<div class="preview-wrap">
				<iframe src={selectedSourceUrl} title="Kilde preview"></iframe>
			</div>
		{:else}
			<p class="empty">Ingen kilde valgt endnu.</p>
		{/if}
	</section>

	<section class="panel">
		<div class="panel__head">
			<h2>4) Drafts ({data.drafts.length})</h2>
		</div>
		<div class="content-list">
			{#if data.drafts.length === 0}
				<p class="empty">Ingen drafts endnu.</p>
			{:else}
				{#each data.drafts as draft (draft.id)}
					<div class="row">
						<div class="row__main">
							<div class="row__title"><span class="badge badge--draft">draft</span>{draft.title}</div>
							<p class="row__meta">
								{draft.locality ?? 'Sted ukendt'} · {draft.start_date ? fmtDate(draft.start_date) : 'Dato ukendt'} · Oprettet: {fmtDateTime(draft.created_at)}
							</p>
							{#if draft.external_url}<p class="row__url">{draft.external_url}</p>{/if}
						</div>
						<div class="row__actions">
							<a href={resolve(`/tours/${draft.id}/edit`)} class="btn-icon btn-icon--edit" title="Rediger">
								<span class="material-symbols-outlined">edit</span>
							</a>
							<form method="POST" action="?/publishDraft" use:enhance>
								<input type="hidden" name="id" value={draft.id} />
								<button type="submit" class="btn-publish" title="Publicer">
									<span class="material-symbols-outlined">publish</span>Publicer
								</button>
							</form>
							<form method="POST" action="?/deleteDraft" use:enhance onsubmit={(e) => { if (!confirm(`Slet kladden "${draft.title}"?`)) e.preventDefault(); }}>
								<input type="hidden" name="id" value={draft.id} />
								<button type="submit" class="btn-icon btn-icon--danger" title="Slet">
									<span class="material-symbols-outlined">delete</span>
								</button>
							</form>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</section>

	<section class="panel">
		<div class="panel__head">
			<h2>Kørselslog</h2>
		</div>
		<div class="content-list">
			{#if data.runs.length === 0}
				<p class="empty">Ingen kørsler endnu.</p>
			{:else}
				{#each data.runs as run (run.id)}
					<div class="run-row">
						<div class="run-row__left">
							<span class="run-type run-type--{run.run_type}">
								<span class="material-symbols-outlined">{run.run_type === 'search' ? 'travel_explore' : 'data_object'}</span>
								{run.run_type === 'search' ? 'Søgning' : 'Extract'}
							</span>
							<span class="run-status run-status--{run.status}">
								<span class="material-symbols-outlined">{run.status === 'completed' ? 'check_circle' : run.status === 'failed' ? 'error' : 'pending'}</span>
								{run.status}
							</span>
						</div>
						<div class="run-row__stats">{run.run_type === 'search' ? `${run.sources_found} kilder` : `${run.events_created} drafts`}</div>
						<div class="run-row__time">{fmtDateTime(run.started_at)}{#if run.completed_at} → {fmtDateTime(run.completed_at)}{/if}</div>
						{#if run.error_message}<p class="run-row__error">{run.error_message}</p>{/if}
					</div>
				{/each}
			{/if}
		</div>
	</section>
</div>

<style>
	.scraper {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.scraper__header { margin-bottom: 0.5rem; }

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
	.back-link:hover { color: var(--color-primary); text-decoration: none; }
	.back-link .material-symbols-outlined { font-size: 18px; }

	.scraper__header h1 { margin: 0 0 0.25rem; }
	.scraper__sub { font-size: var(--font-size-sm); color: var(--color-text-muted); margin: 0; }

	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border-light);
		border-radius: var(--border-radius);
	}

	.panel__head {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.panel__head h2 {
		margin: 0;
		font-size: 1rem;
	}

	.panel__head p {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.search-grid {
		display: grid;
		grid-template-columns: 1.7fr 1.1fr 120px;
		gap: 0.5rem;
		align-items: end;
	}

	@media (max-width: 900px) {
		.search-grid { grid-template-columns: 1fr; }
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.field span {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.field textarea,
	.field input {
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius);
		background: var(--color-bg);
		color: inherit;
		padding: 0.45rem 0.55rem;
		font: inherit;
		font-size: var(--font-size-sm);
	}

	.field textarea {
		min-height: 4.5rem;
		resize: vertical;
	}

	.panel__actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.btn-run {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.6rem 1.2rem;
		background: var(--color-primary);
		color: white;
		border: 1px solid var(--color-primary-border);
		border-radius: var(--border-radius-full);
		font: inherit;
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
		transition: background var(--transition-fast), opacity var(--transition-fast);
		align-self: center;
	}
	.btn-run:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-run:not(:disabled):hover {
		background: var(--color-primary-dark, #0056b3);
		border-color: var(--color-primary-border);
	}
	.btn-run .material-symbols-outlined { font-size: 18px; }
	.btn-run--extract {
		background: #7c3aed;
		border-color: #4c1d95;
	}
	.btn-run--extract:not(:disabled):hover {
		background: #6d28d9;
		border-color: #4c1d95;
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--font-size-xs);
		font-weight: 600;
		padding: 0.25rem 0.5rem;
		border-radius: var(--border-radius);
	}
	.status--ok { background: rgba(34,197,94,0.1); color: #16a34a; }
	.status--err { background: rgba(239,68,68,0.1); color: #dc2626; }

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255,255,255,0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		flex-shrink: 0;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	.content-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.empty {
		text-align: center;
		color: var(--color-text-muted);
		padding: 3rem 0;
		font-size: var(--font-size-sm);
	}

	/* ── Generic row ── */
	.row {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		background: var(--color-bg);
		border: 1px solid var(--color-border-light);
		border-radius: var(--border-radius);
	}

	.row--select {
		text-align: left;
		width: 100%;
		cursor: pointer;
		font: inherit;
		color: inherit;
	}
	.row--selected {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 40%, transparent);
	}

	.row--inactive { opacity: 0.55; }
	.row__main { flex: 1; min-width: 0; }

	.row__title {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-weight: 600;
		margin-bottom: 0.2rem;
		flex-wrap: wrap;
	}

	.row__link {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		color: var(--color-primary);
		text-decoration: none;
	}
	.row__link:hover { text-decoration: underline; }
	.row__ext { font-size: 14px !important; }

	.row__meta {
		margin: 0 0 0.25rem;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.row__url {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row__actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	/* ── Badges ── */
	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.1rem 0.45rem;
		border-radius: var(--border-radius-full);
		font-size: var(--font-size-xs);
		font-weight: 600;
	}
	.badge--draft { background: rgba(124,58,237,0.1); color: #7c3aed; }
	.badge--muted { background: var(--color-bg-muted); color: var(--color-text-muted); }

	/* ── Buttons ── */
	.btn-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		background: none;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
		color: var(--color-text-muted);
		cursor: pointer;
		text-decoration: none;
		transition: background var(--transition-fast), color var(--transition-fast);
	}
	.btn-icon:hover { background: var(--color-bg-muted); color: var(--color-text); text-decoration: none; }
	.btn-icon .material-symbols-outlined { font-size: 18px; }
	.btn-icon--danger { color: #ef4444; }
	.btn-icon--danger:hover { background: rgba(239,68,68,0.08); color: #ef4444; }
	.btn-icon--edit:hover { color: var(--color-primary); }

	.btn-publish {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.3rem 0.75rem;
		background: #22c55e;
		color: white;
		border: none;
		border-radius: var(--border-radius-full);
		font: inherit;
		font-size: var(--font-size-xs);
		font-weight: 600;
		cursor: pointer;
		transition: background var(--transition-fast);
	}
	.btn-publish:hover { background: #16a34a; }
	.btn-publish .material-symbols-outlined { font-size: 15px; }

	.extract-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.extract-toolbar__source {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.extract-toolbar__source span {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		word-break: break-all;
	}

	.preview-wrap {
		border: 1px solid var(--color-border-light);
		border-radius: var(--border-radius);
		overflow: hidden;
	}
	.preview-wrap iframe {
		display: block;
		width: 100%;
		height: 70vh;
		border: 0;
		background: white;
	}

	.run-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		padding: 0.875rem 1.25rem;
		background: var(--color-surface);
		border: var(--border-width) solid var(--color-border-light);
		border-radius: var(--border-radius-lg);
		font-size: var(--font-size-sm);
	}

	.run-row__left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.run-type, .run-status {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.15rem 0.5rem;
		border-radius: var(--border-radius-full);
		font-size: var(--font-size-xs);
		font-weight: 600;
	}
	.run-type .material-symbols-outlined,
	.run-status .material-symbols-outlined { font-size: 13px; }

	.run-type--search { background: rgba(59,130,246,0.1); color: #2563eb; }
	.run-type--scrape { background: rgba(124,58,237,0.1); color: #7c3aed; }
	.run-status--completed { background: rgba(34,197,94,0.1); color: #16a34a; }
	.run-status--failed { background: rgba(239,68,68,0.1); color: #dc2626; }
	.run-status--running { background: rgba(234,179,8,0.1); color: #ca8a04; }

	.run-row__stats { color: var(--color-text-muted); font-size: var(--font-size-xs); }
	.run-row__time { margin-left: auto; color: var(--color-text-muted); font-size: var(--font-size-xs); }

	.run-row__error {
		width: 100%;
		margin: 0.25rem 0 0;
		font-size: var(--font-size-xs);
		color: #dc2626;
		font-family: monospace;
		background: rgba(239,68,68,0.05);
		padding: 0.3rem 0.5rem;
		border-radius: var(--border-radius);
	}

	.run-row__error { white-space: pre-wrap; }
</style>
