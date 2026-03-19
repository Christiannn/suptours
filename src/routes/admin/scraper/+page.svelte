<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let activeTab = $state<'sources' | 'drafts' | 'runs'>('sources');

	// Scraper state
	let searching = $state(false);
	let scraping = $state(false);
	let searchResult = $state<{ ok: boolean; sourcesFound?: number; error?: string } | null>(null);
	let scrapeResult = $state<{ ok: boolean; eventsCreated?: number; error?: string } | null>(null);

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
			const res = await fetch('/api/scraper/search', { method: 'POST' });
			const json = await res.json();
			searchResult = res.ok ? { ok: true, sourcesFound: json.sourcesFound } : { ok: false, error: json.message ?? 'Fejl' };
			if (res.ok) await invalidateAll();
		} catch (e) {
			searchResult = { ok: false, error: String(e) };
		} finally {
			searching = false;
		}
	}

	async function runScrape() {
		scraping = true;
		scrapeResult = null;
		try {
			const res = await fetch('/api/scraper/scrape', { method: 'POST' });
			const json = await res.json();
			scrapeResult = res.ok ? { ok: true, eventsCreated: json.eventsCreated } : { ok: false, error: json.message ?? 'Fejl' };
			if (res.ok) await invalidateAll();
		} catch (e) {
			scrapeResult = { ok: false, error: String(e) };
		} finally {
			scraping = false;
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
			{data.drafts.length} kladder afventer godkendelse
		</p>
	</div>

	<!-- Action bar -->
	<div class="action-bar">
		<div class="action-card">
			<div class="action-card__icon">
				<span class="material-symbols-outlined">travel_explore</span>
			</div>
			<div class="action-card__body">
				<strong>Fase 1 – Søg efter kilder</strong>
				<p>Brug Claude + Brave Search til at finde nye SUP-event websites i Danmark og gem dem som aktive kilder.</p>
				{#if searchResult}
					<p class="action-card__result" class:action-card__result--ok={searchResult.ok} class:action-card__result--err={!searchResult.ok}>
						{#if searchResult.ok}
							<span class="material-symbols-outlined">check_circle</span>
							{searchResult.sourcesFound} nye/opdaterede kilder fundet
						{:else}
							<span class="material-symbols-outlined">error</span>
							{searchResult.error}
						{/if}
					</p>
				{/if}
			</div>
			<button class="btn-run" onclick={runSearch} disabled={searching || scraping}>
				{#if searching}
					<span class="spinner"></span>
					Søger…
				{:else}
					<span class="material-symbols-outlined">search</span>
					Kør søgning
				{/if}
			</button>
		</div>

		<div class="action-card">
			<div class="action-card__icon">
				<span class="material-symbols-outlined">data_object</span>
			</div>
			<div class="action-card__body">
				<strong>Fase 2 – Skrab arrangementer</strong>
				<p>Besøg alle aktive kilder og lad Claude udtrække SUP-arrangementer som kladder til din godkendelse.</p>
				{#if scrapeResult}
					<p class="action-card__result" class:action-card__result--ok={scrapeResult.ok} class:action-card__result--err={!scrapeResult.ok}>
						{#if scrapeResult.ok}
							<span class="material-symbols-outlined">check_circle</span>
							{scrapeResult.eventsCreated} arrangementer oprettet som kladder
						{:else}
							<span class="material-symbols-outlined">error</span>
							{scrapeResult.error}
						{/if}
					</p>
				{/if}
			</div>
			<button class="btn-run btn-run--scrape" onclick={runScrape} disabled={searching || scraping || data.sources.filter(s => s.is_active).length === 0}>
				{#if scraping}
					<span class="spinner"></span>
					Skraber…
				{:else}
					<span class="material-symbols-outlined">bolt</span>
					Kør skraber
				{/if}
			</button>
		</div>
	</div>

	<!-- Tabs -->
	<div class="tabs">
		<button class="tab" class:tab--active={activeTab === 'sources'} onclick={() => activeTab = 'sources'}>
			<span class="material-symbols-outlined">link</span>
			Kilder
			<span class="tab__count">{data.sources.length}</span>
		</button>
		<button class="tab" class:tab--active={activeTab === 'drafts'} onclick={() => activeTab = 'drafts'}>
			<span class="material-symbols-outlined">draft</span>
			Kladder
			{#if data.drafts.length > 0}
				<span class="tab__badge">{data.drafts.length}</span>
			{/if}
		</button>
		<button class="tab" class:tab--active={activeTab === 'runs'} onclick={() => activeTab = 'runs'}>
			<span class="material-symbols-outlined">history</span>
			Kørselslog
		</button>
	</div>

	<!-- Sources tab -->
	{#if activeTab === 'sources'}
		<div class="content-list">
			{#if data.sources.length === 0}
				<p class="empty">Ingen kilder endnu. Kør en søgning for at finde SUP-event websites.</p>
			{:else}
				{#each data.sources as src (src.id)}
					<div class="row" class:row--inactive={!src.is_active}>
						<div class="row__main">
							<div class="row__title">
								<a href={src.url} target="_blank" rel="noopener" class="row__link">
									{src.domain}
									<span class="material-symbols-outlined row__ext">open_in_new</span>
								</a>
								{#if !src.is_active}
									<span class="badge badge--muted">inaktiv</span>
								{/if}
							</div>
							<p class="row__meta">
								Fundet: {fmtDate(src.last_searched_at)} ·
								Sidst skrabet: {fmtDate(src.last_scraped_at)} ·
								{src.scrape_count} kørsel(er)
							</p>
							<p class="row__url">{src.url}</p>
						</div>
						<div class="row__actions">
							<form method="POST" action="?/toggleSource" use:enhance>
								<input type="hidden" name="id" value={src.id} />
								<input type="hidden" name="is_active" value={String(src.is_active)} />
								<button type="submit" class="btn-icon" title={src.is_active ? 'Deaktiver' : 'Aktiver'}>
									<span class="material-symbols-outlined">
										{src.is_active ? 'pause_circle' : 'play_circle'}
									</span>
								</button>
							</form>
							<form method="POST" action="?/deleteSource" use:enhance
								onsubmit={(e) => { if (!confirm(`Slet kilden "${src.domain}"?`)) e.preventDefault(); }}>
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
	{/if}

	<!-- Drafts tab -->
	{#if activeTab === 'drafts'}
		<div class="content-list">
			{#if data.drafts.length === 0}
				<p class="empty">Ingen kladder. Kør skraberen for at hente arrangementer fra kilderne.</p>
			{:else}
				{#each data.drafts as draft (draft.id)}
					<div class="row">
						<div class="row__main">
							<div class="row__title">
								<span class="badge badge--draft">kladde</span>
								{draft.title}
							</div>
							<p class="row__meta">
								{draft.locality ?? 'Sted ukendt'} ·
								{draft.start_date ? fmtDate(draft.start_date) : 'Dato ukendt'} ·
								Oprettet: {fmtDateTime(draft.created_at)}
							</p>
							{#if draft.description}
								<p class="row__desc">{draft.description}</p>
							{/if}
							{#if draft.external_url}
								<a href={draft.external_url} target="_blank" rel="noopener" class="row__source-link">
									<span class="material-symbols-outlined">open_in_new</span>
									Vis kilde
								</a>
							{/if}
						</div>
						<div class="row__actions">
							<a
								href={resolve(`/tours/${draft.id}/edit`)}
								class="btn-icon btn-icon--edit"
								title="Rediger"
							>
								<span class="material-symbols-outlined">edit</span>
							</a>
							<form method="POST" action="?/publishDraft" use:enhance>
								<input type="hidden" name="id" value={draft.id} />
								<button type="submit" class="btn-publish" title="Publicer">
									<span class="material-symbols-outlined">publish</span>
									Publicer
								</button>
							</form>
							<form method="POST" action="?/deleteDraft" use:enhance
								onsubmit={(e) => { if (!confirm(`Slet kladden "${draft.title}"?`)) e.preventDefault(); }}>
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
	{/if}

	<!-- Runs tab -->
	{#if activeTab === 'runs'}
		<div class="content-list">
			{#if data.runs.length === 0}
				<p class="empty">Ingen kørsler endnu.</p>
			{:else}
				{#each data.runs as run (run.id)}
					<div class="run-row">
						<div class="run-row__left">
							<span class="run-type run-type--{run.run_type}">
								<span class="material-symbols-outlined">
									{run.run_type === 'search' ? 'travel_explore' : 'data_object'}
								</span>
								{run.run_type === 'search' ? 'Søgning' : 'Skraber'}
							</span>
							<span class="run-status run-status--{run.status}">
								<span class="material-symbols-outlined">
									{run.status === 'completed' ? 'check_circle' : run.status === 'failed' ? 'error' : 'pending'}
								</span>
								{run.status}
							</span>
						</div>
						<div class="run-row__stats">
							{#if run.run_type === 'search'}
								<span>{run.sources_found} kilder</span>
							{:else}
								<span>{run.events_created} events</span>
							{/if}
						</div>
						<div class="run-row__time">
							{fmtDateTime(run.started_at)}
							{#if run.completed_at}
								→ {fmtDateTime(run.completed_at)}
							{/if}
						</div>
						{#if run.error_message}
							<p class="run-row__error">{run.error_message}</p>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	.scraper {
		max-width: 960px;
		margin: 0 auto;
		padding: var(--section-padding);
	}

	.scraper__header { margin-bottom: 1.5rem; }

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

	/* ── Action bar ── */
	.action-bar {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	@media (max-width: 640px) {
		.action-bar { grid-template-columns: 1fr; }
	}

	.action-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.25rem;
		background: var(--color-surface);
		border: var(--border-width) solid var(--color-border-light);
		border-radius: var(--border-radius-lg);
	}

	.action-card__icon .material-symbols-outlined {
		font-size: 2rem;
		color: var(--color-primary);
	}

	.action-card__body strong { display: block; margin-bottom: 0.25rem; }

	.action-card__body p {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	.action-card__result {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.5rem !important;
		font-size: var(--font-size-xs) !important;
		font-weight: 600;
		padding: 0.25rem 0.5rem;
		border-radius: var(--border-radius);
	}
	.action-card__result .material-symbols-outlined { font-size: 15px; }
	.action-card__result--ok { background: rgba(34,197,94,0.1); color: #16a34a; }
	.action-card__result--err { background: rgba(239,68,68,0.1); color: #dc2626; }

	.btn-run {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.6rem 1.2rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--border-radius-full);
		font: inherit;
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
		transition: background var(--transition-fast), opacity var(--transition-fast);
		align-self: flex-start;
	}
	.btn-run:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-run:not(:disabled):hover { background: var(--color-primary-dark, #0056b3); }
	.btn-run .material-symbols-outlined { font-size: 18px; }
	.btn-run--scrape { background: #7c3aed; }
	.btn-run--scrape:not(:disabled):hover { background: #6d28d9; }

	/* ── Spinner ── */
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

	/* ── Tabs ── */
	.tabs {
		display: flex;
		gap: 0.25rem;
		border-bottom: var(--border-width) solid var(--color-border-light);
		margin-bottom: 1.5rem;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.6rem 1rem;
		background: none;
		border: none;
		font: inherit;
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--color-text-muted);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		transition: color var(--transition-fast), border-color var(--transition-fast);
	}
	.tab .material-symbols-outlined { font-size: 17px; }
	.tab:hover { color: var(--color-text); }
	.tab--active { color: var(--color-primary); border-bottom-color: var(--color-primary); }

	.tab__count {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}
	.tab__badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.2rem;
		height: 1.2rem;
		padding: 0 0.2rem;
		background: #f97316;
		color: white;
		border-radius: var(--border-radius-full);
		font-size: 0.7rem;
		font-weight: 700;
	}

	/* ── Content list ── */
	.content-list {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
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
		gap: 1rem;
		padding: 1rem 1.25rem;
		background: var(--color-surface);
		border: var(--border-width) solid var(--color-border-light);
		border-radius: var(--border-radius-lg);
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

	.row__desc {
		margin: 0.25rem 0 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		line-height: 1.4;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.row__source-link {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		margin-top: 0.35rem;
		font-size: var(--font-size-xs);
		color: var(--color-primary);
		text-decoration: none;
	}
	.row__source-link .material-symbols-outlined { font-size: 13px; }
	.row__source-link:hover { text-decoration: underline; }

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

	/* ── Run log rows ── */
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
</style>
