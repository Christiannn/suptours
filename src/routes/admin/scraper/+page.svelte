<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { loadStoredAiPrefs, prefsToApiBody } from '$lib/admin/aiPreferences';

	let { data } = $props();

	let searching = $state(false);
	let extracting = $state(false);
	let batchRunning = $state(false);

	type SearchStats = {
		queriesRun: number;
		rawResults: number;
		afterDedupe: number;
		afterScoring: number;
		afterAi: number;
		queryErrors: string[];
	};

	let searchResult = $state<
		| { ok: true; created: number; updated: number; stats: SearchStats }
		| { ok: false; error: string }
		| null
	>(null);

	type RejectedEvent = { title: string; reason: string };
	let extractResult = $state<
		| {
				ok: true;
				draftsCreated: number;
				draftsUpdated: number;
				skipped: number;
				extracted: number;
				rejected: RejectedEvent[];
				notes: string[];
		  }
		| { ok: false; error: string }
		| null
	>(null);

	let batchResult = $state<
		| { ok: true; sourcesProcessed: number; eventsCreated: number; eventsUpdated: number }
		| { ok: false; error: string }
		| null
	>(null);

	// ── Søgeindstillinger ────────────────────────────────────────────────────
	let strategy = $state<'curated' | 'broad' | 'exhaustive'>('broad');
	let searchTermsInput = $state('');
	let replaceQueries = $state(false);
	let domainPatternsInput = $state('');
	let seedDomainsInput = $state('dgi.dk, kano-kajak.dk, billetto.dk, eventbrite.dk');
	let maxResults = $state(60);
	let pages = $state(1);
	let deepDiscovery = $state(false);

	// ── Udtrækningsindstillinger ─────────────────────────────────────────────
	let selectedSourceUrl = $state<string | null>(null);
	let selectedSourceDomain = $state<string | null>(null);
	let followLinks = $state(true);
	let maxLinkedPages = $state(5);
	let includePast = $state(false);
	let pruneStale = $state(true);
	let extractionInstructions = $state(
		'Find kun reelle SUP-arrangementer med en konkret dato. Ignorer produktsider, generel klubinfo og menupunkter.'
	);

	let showRejected = $state(false);

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
			year: 'numeric'
		});
	}

	function fmtDateTime(d: string | null) {
		if (!d) return '—';
		return new Date(d).toLocaleString('da-DK', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	const KIND_LABEL: Record<string, string> = {
		event_calendar: 'Kalender',
		club: 'Klub',
		single_event: 'Enkelt event',
		operator: 'Udbyder',
		other: 'Andet'
	};

	/** Første meta-række fra join'et — Supabase returnerer array eller objekt. */
	function metaOf(draft: (typeof data.drafts)[number]) {
		const meta = draft.scraper_draft_meta as unknown;
		if (Array.isArray(meta)) return meta[0] ?? null;
		return (meta as Record<string, unknown> | null) ?? null;
	}

	function confidenceOf(draft: (typeof data.drafts)[number]): number {
		const value = metaOf(draft)?.confidence;
		return typeof value === 'number' ? value : 0;
	}

	function confidenceClass(value: number): string {
		if (value >= 80) return 'conf--high';
		if (value >= 55) return 'conf--mid';
		return 'conf--low';
	}

	const activeSources = $derived(data.sources.filter((s) => s.is_active));
	const highConfidenceCount = $derived(data.drafts.filter((d) => confidenceOf(d) >= 80).length);

	/** Kladder sorteret: højeste konfidens først, så de nemme kan hastegodkendes. */
	const sortedDrafts = $derived([...data.drafts].sort((a, b) => confidenceOf(b) - confidenceOf(a)));

	async function postJson(url: string, body: Record<string, unknown>) {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...prefsToApiBody(loadStoredAiPrefs()), ...body })
		});
		const payload = await res.json().catch(() => ({}));
		return { ok: res.ok, payload };
	}

	async function runSearch() {
		searching = true;
		searchResult = null;
		try {
			const { ok, payload } = await postJson('/api/scraper/search', {
				strategy,
				searchQueries: toList(searchTermsInput),
				replaceQueries: replaceQueries && toList(searchTermsInput).length > 0,
				domainPatterns: toList(domainPatternsInput),
				seedDomains: toList(seedDomainsInput),
				maxResults: Math.max(1, Math.min(300, Number(maxResults) || 60)),
				pages: Math.max(1, Math.min(5, Number(pages) || 1)),
				deepDiscovery
			});
			searchResult = ok
				? {
						ok: true,
						created: payload.created ?? 0,
						updated: payload.updated ?? 0,
						stats: payload.stats
					}
				: { ok: false, error: payload.message ?? 'Søgningen fejlede' };
			if (ok) await invalidateAll();
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
			const { ok, payload } = await postJson('/api/scraper/extract', {
				url: selectedSourceUrl,
				instructions: extractionInstructions,
				followLinks,
				maxLinkedPages: Math.max(0, Math.min(10, Number(maxLinkedPages) || 0)),
				includePast,
				pruneStale
			});
			extractResult = ok
				? {
						ok: true,
						draftsCreated: payload.draftsCreated ?? 0,
						draftsUpdated: payload.draftsUpdated ?? 0,
						skipped: payload.skipped ?? 0,
						extracted: payload.extracted ?? 0,
						rejected: payload.rejected ?? [],
						notes: payload.diagnostics?.notes ?? []
					}
				: { ok: false, error: payload.message ?? 'Udtrækning fejlede' };
			if (ok) await invalidateAll();
		} catch (e) {
			extractResult = { ok: false, error: String(e) };
		} finally {
			extracting = false;
		}
	}

	async function runBatchScrape() {
		batchRunning = true;
		batchResult = null;
		try {
			const { ok, payload } = await postJson('/api/scraper/scrape', {
				instructions: extractionInstructions,
				followLinks,
				maxLinkedPages: Math.max(0, Math.min(10, Number(maxLinkedPages) || 0)),
				includePast
			});
			batchResult = ok
				? {
						ok: true,
						sourcesProcessed: payload.sourcesProcessed ?? 0,
						eventsCreated: payload.eventsCreated ?? 0,
						eventsUpdated: payload.eventsUpdated ?? 0
					}
				: { ok: false, error: payload.message ?? 'Batch-kørsel fejlede' };
			if (ok) await invalidateAll();
		} catch (e) {
			batchResult = { ok: false, error: String(e) };
		} finally {
			batchRunning = false;
		}
	}

	const busy = $derived(searching || extracting || batchRunning);
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
			{data.sources.length} kilder ({activeSources.length} aktive) ·
			{data.drafts.length} kladder afventer godkendelse ·
			<a href={resolve('/admin/agents')}>AI-model</a>
		</p>
	</div>

	<!-- ── 1) Søgning ─────────────────────────────────────────────────────── -->
	<section class="panel">
		<div class="panel__head">
			<h2>1) Find kilder</h2>
			<p>Søger bredt efter danske sider med SUP-arrangementer og gemmer dem som kilder.</p>
		</div>

		<div class="opt-grid">
			<label class="field">
				<span>Strategi</span>
				<select bind:value={strategy}>
					<option value="curated">Kurateret — 15 præcise queries, lavt forbrug</option>
					<option value="broad">Bred — ~40 queries inkl. geografi (anbefalet)</option>
					<option value="exhaustive">Udtømmende — ~90 queries inkl. farvande og klubtyper</option>
				</select>
			</label>
			<label class="field field--sm">
				<span>Maks kilder</span>
				<input type="number" min="1" max="300" bind:value={maxResults} />
			</label>
			<label class="field field--sm">
				<span>Sider pr. query</span>
				<input type="number" min="1" max="5" bind:value={pages} />
			</label>
		</div>

		<details class="advanced">
			<summary>Avancerede søgeindstillinger</summary>
			<div class="opt-grid opt-grid--wide">
				<label class="field">
					<span>Egne søgetermer (komma-separeret — tilføjes til kataloget)</span>
					<textarea
						bind:value={searchTermsInput}
						rows="2"
						placeholder="fx: SUP yoga København, downwind race Limfjorden"
					></textarea>
				</label>
				<label class="field">
					<span>Seed-domæner til <code>site:</code>-søgning</span>
					<textarea bind:value={seedDomainsInput} rows="2"></textarea>
				</label>
				<label class="field">
					<span>Domænefilter (wildcard <code>*</code>, tom = alle)</span>
					<input type="text" bind:value={domainPatternsInput} placeholder="fx: *.dk*" />
				</label>
			</div>
			<div class="toggles">
				<label class="toggle">
					<input type="checkbox" bind:checked={replaceQueries} />
					<span>Brug <em>kun</em> mine egne søgetermer</span>
				</label>
				<label class="toggle">
					<input type="checkbox" bind:checked={deepDiscovery} />
					<span>Dybde-opdagelse: søg efter flere eventsider på de domæner vi allerede kender</span>
				</label>
			</div>
		</details>

		<div class="panel__actions">
			<button class="btn-run" onclick={runSearch} disabled={busy}>
				{#if searching}<span class="spinner"></span>Søger…{:else}<span
						class="material-symbols-outlined">travel_explore</span
					>Kør søgning{/if}
			</button>
			{#if searchResult}
				{#if searchResult.ok}
					<p class="status status--ok">
						<span class="material-symbols-outlined">check_circle</span>
						{searchResult.created} nye · {searchResult.updated} opdaterede
					</p>
					{#if searchResult.stats}
						<p class="funnel">
							{searchResult.stats.queriesRun} queries →
							{searchResult.stats.rawResults} rå →
							{searchResult.stats.afterDedupe} unikke →
							{searchResult.stats.afterScoring} relevante →
							{searchResult.stats.afterAi} godkendt af AI
						</p>
					{/if}
					{#if searchResult.stats?.queryErrors?.length}
						<p class="status status--warn">
							<span class="material-symbols-outlined">warning</span>
							{searchResult.stats.queryErrors.length} query/queries fejlede
						</p>
					{/if}
				{:else}
					<p class="status status--err">
						<span class="material-symbols-outlined">error</span>
						{searchResult.error}
					</p>
				{/if}
			{/if}
		</div>
	</section>

	<!-- ── 2) Kilder ──────────────────────────────────────────────────────── -->
	<section class="panel">
		<div class="panel__head">
			<h2>2) Kilder ({data.sources.length})</h2>
			<p>Vælg en kilde for at se den i preview og køre udtrækning på den alene.</p>
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
								{#if src.kind}
									<span class="badge badge--kind">{KIND_LABEL[src.kind] ?? src.kind}</span>
								{/if}
								{#if src.ai_confidence != null}
									<span class="badge badge--score" title="AI-konfidens at siden har events">
										{src.ai_confidence}%
									</span>
								{/if}
								{#if src.last_event_count > 0}
									<span class="badge badge--good" title="Events fundet ved sidste udtrækning">
										{src.last_event_count} events
									</span>
								{/if}
								{#if src.consecutive_failures >= 4}
									<span class="badge badge--bad" title="Springes over i batch-kørsler">
										{src.consecutive_failures} tomme kørsler
									</span>
								{/if}
								{#if !src.is_active}<span class="badge badge--muted">inaktiv</span>{/if}
							</div>
							{#if src.title}<p class="row__meta row__meta--strong">{src.title}</p>{/if}
							<p class="row__meta">
								Fundet: {fmtDate(src.last_searched_at)} · Udtrukket: {fmtDate(src.last_scraped_at)} ·
								{src.scrape_count} kørsler
								{#if src.found_via}
									· via “{src.found_via}”{/if}
							</p>
							<p class="row__url">{src.url}</p>
							{#if src.last_error}
								<p class="row__error">{src.last_error}</p>
							{/if}
						</div>
						<div class="row__actions">
							{#if src.consecutive_failures > 0}
								<form method="POST" action="?/resetFailures" use:enhance>
									<input type="hidden" name="id" value={src.id} />
									<button type="submit" class="btn-icon" title="Nulstil fejltæller">
										<span class="material-symbols-outlined">restart_alt</span>
									</button>
								</form>
							{/if}
							<form method="POST" action="?/toggleSource" use:enhance>
								<input type="hidden" name="id" value={src.id} />
								<input type="hidden" name="is_active" value={String(src.is_active)} />
								<button
									type="submit"
									class="btn-icon"
									title={src.is_active ? 'Deaktiver' : 'Aktiver'}
								>
									<span class="material-symbols-outlined"
										>{src.is_active ? 'pause_circle' : 'play_circle'}</span
									>
								</button>
							</form>
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- ekstern kilde-URL, ikke en app-rute -->
							<a href={src.url} target="_blank" rel="noopener" class="btn-icon" title="Åbn ekstern">
								<span class="material-symbols-outlined">open_in_new</span>
							</a>
							<form
								method="POST"
								action="?/deleteSource"
								use:enhance
								onsubmit={(e) => {
									if (!confirm(`Slet kilden "${src.domain}"?`)) e.preventDefault();
								}}
							>
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

	<!-- ── 3) Udtrækning ──────────────────────────────────────────────────── -->
	<section class="panel">
		<div class="panel__head">
			<h2>3) Udtræk arrangementer</h2>
			<p>Kør på den valgte kilde, eller batch-kør alle aktive kilder.</p>
		</div>

		<div class="opt-grid opt-grid--wide">
			<label class="field">
				<span>Instruktioner til AI'en</span>
				<textarea bind:value={extractionInstructions} rows="2"></textarea>
			</label>
			<label class="field field--sm">
				<span>Maks undersider</span>
				<input type="number" min="0" max="10" bind:value={maxLinkedPages} />
			</label>
		</div>

		<div class="toggles">
			<label class="toggle">
				<input type="checkbox" bind:checked={followLinks} />
				<span>Følg links til enkelt-events (bedre detaljer, flere AI-kald)</span>
			</label>
			<label class="toggle">
				<input type="checkbox" bind:checked={includePast} />
				<span>Medtag arrangementer i fortiden</span>
			</label>
			<label class="toggle">
				<input type="checkbox" bind:checked={pruneStale} />
				<span>Ryd kladder fra kilden der ikke længere står på siden</span>
			</label>
		</div>

		<div class="panel__actions">
			<button
				class="btn-run btn-run--extract"
				onclick={runSingleExtract}
				disabled={busy || !selectedSourceUrl}
			>
				{#if extracting}<span class="spinner"></span>Udtrækker…{:else}<span
						class="material-symbols-outlined">bolt</span
					>Udtræk fra valgt kilde{/if}
			</button>
			<button
				class="btn-run btn-run--batch"
				onclick={runBatchScrape}
				disabled={busy || activeSources.length === 0}
			>
				{#if batchRunning}<span class="spinner"></span>Kører batch…{:else}<span
						class="material-symbols-outlined">playlist_play</span
					>Batch: alle {activeSources.length} aktive kilder{/if}
			</button>
		</div>

		{#if extractResult}
			{#if extractResult.ok}
				<p class="status status--ok">
					<span class="material-symbols-outlined">check_circle</span>
					{extractResult.draftsCreated} nye · {extractResult.draftsUpdated} opdaterede ·
					{extractResult.skipped} sprunget over
					{#if extractResult.rejected.length}
						· {extractResult.rejected.length} filtreret fra{/if}
				</p>
				{#each extractResult.notes as note, i (i)}
					<p class="note">{note}</p>
				{/each}
				{#if extractResult.rejected.length}
					<button class="link-btn" onclick={() => (showRejected = !showRejected)}>
						{showRejected ? 'Skjul' : 'Vis'} de {extractResult.rejected.length} frafiltrerede
					</button>
					{#if showRejected}
						<ul class="rejected">
							{#each extractResult.rejected as item, i (i)}
								<li><strong>{item.title}</strong> — {item.reason}</li>
							{/each}
						</ul>
					{/if}
				{/if}
			{:else}
				<p class="status status--err">
					<span class="material-symbols-outlined">error</span>
					{extractResult.error}
				</p>
			{/if}
		{/if}

		{#if batchResult}
			<p class="status" class:status--ok={batchResult.ok} class:status--err={!batchResult.ok}>
				<span class="material-symbols-outlined">{batchResult.ok ? 'check_circle' : 'error'}</span>
				{#if batchResult.ok}
					{batchResult.sourcesProcessed} kilder · {batchResult.eventsCreated} nye · {batchResult.eventsUpdated}
					opdaterede
				{:else}
					{batchResult.error}
				{/if}
			</p>
		{/if}

		{#if selectedSourceUrl}
			<div class="extract-toolbar">
				<div class="extract-toolbar__source">
					<strong>{selectedSourceDomain}</strong>
					<span>{selectedSourceUrl}</span>
				</div>
			</div>
			<div class="preview-wrap">
				<iframe src={selectedSourceUrl} title="Kilde preview"></iframe>
			</div>
		{:else}
			<p class="empty">Vælg en kilde ovenfor for at se den i preview.</p>
		{/if}
	</section>

	<!-- ── 4) Kladder ─────────────────────────────────────────────────────── -->
	<section class="panel">
		<div class="panel__head">
			<h2>4) Kladder ({data.drafts.length})</h2>
			<p>Sorteret efter konfidens. Kontrollér altid dato og sted mod kilden før publicering.</p>
		</div>

		{#if data.drafts.length > 0}
			<div class="panel__actions">
				{#if highConfidenceCount > 0}
					<form method="POST" action="?/publishHighConfidence" use:enhance>
						<input type="hidden" name="threshold" value="80" />
						<button
							type="submit"
							class="btn-publish"
							onclick={(e) => {
								if (!confirm(`Publicér alle ${highConfidenceCount} kladder med konfidens ≥ 80?`))
									e.preventDefault();
							}}
						>
							<span class="material-symbols-outlined">publish</span>
							Publicér {highConfidenceCount} med høj konfidens
						</button>
					</form>
				{/if}
				<form
					method="POST"
					action="?/deleteAllDrafts"
					use:enhance
					onsubmit={(e) => {
						if (!confirm(`Slet ALLE ${data.drafts.length} kladder?`)) e.preventDefault();
					}}
				>
					<button type="submit" class="btn-danger-text">
						<span class="material-symbols-outlined">delete_sweep</span>
						Ryd alle kladder
					</button>
				</form>
			</div>
		{/if}

		<div class="content-list">
			{#if sortedDrafts.length === 0}
				<p class="empty">Ingen kladder endnu.</p>
			{:else}
				{#each sortedDrafts as draft (draft.id)}
					{@const meta = metaOf(draft)}
					{@const confidence = confidenceOf(draft)}
					<div class="row draft-row">
						{#if draft.image_url}
							<img class="draft-row__thumb" src={draft.image_url} alt="" loading="lazy" />
						{/if}
						<div class="row__main">
							<div class="row__title">
								<span class="conf {confidenceClass(confidence)}" title="Konfidens fra udtrækningen">
									{confidence}
								</span>
								{draft.title}
							</div>
							<p class="row__meta row__meta--strong">
								<span class="material-symbols-outlined">event</span>
								{fmtDate(
									draft.start_date
								)}{#if draft.end_date && draft.end_date !== draft.start_date}
									– {fmtDate(draft.end_date)}{/if}
								{#if draft.start_time}
									kl. {draft.start_time.slice(0, 5)}{/if}
								{#if draft.locality}
									· <span class="material-symbols-outlined">location_on</span>{draft.locality}{/if}
							</p>
							{#if draft.description}
								<p class="draft-row__desc">{draft.description}</p>
							{/if}
							<p class="row__meta">
								{#if meta?.organizer}Arrangør: {meta.organizer} ·
								{/if}
								{#if meta?.price}Pris: {meta.price} ·
								{/if}
								{#if meta?.distance_km}{meta.distance_km} km ·
								{/if}
								{#if meta?.difficulty}Niveau: {meta.difficulty} ·
								{/if}
								{#if draft.max_participants}Maks {draft.max_participants} ·
								{/if}
								{(draft.tags ?? []).join(', ')}
							</p>
							{#if meta?.evidence}
								<p class="draft-row__evidence">
									<span class="material-symbols-outlined">format_quote</span>
									{meta.evidence}
								</p>
							{/if}
							{#if draft.external_url}
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- ekstern arrangements-URL -->
								<a href={draft.external_url} class="draft-row__link" target="_blank" rel="noopener">
									{draft.external_url}
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
									<span class="material-symbols-outlined">publish</span>Publicer
								</button>
							</form>
							<form
								method="POST"
								action="?/deleteDraft"
								use:enhance
								onsubmit={(e) => {
									if (!confirm(`Slet kladden "${draft.title}"?`)) e.preventDefault();
								}}
							>
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

	<!-- ── Kørselslog ─────────────────────────────────────────────────────── -->
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
								<span class="material-symbols-outlined"
									>{run.run_type === 'search' ? 'travel_explore' : 'data_object'}</span
								>
								{run.run_type === 'search' ? 'Søgning' : 'Udtræk'}
							</span>
							<span class="run-status run-status--{run.status}">
								<span class="material-symbols-outlined"
									>{run.status === 'completed'
										? 'check_circle'
										: run.status === 'failed'
											? 'error'
											: 'pending'}</span
								>
								{run.status}
							</span>
						</div>
						<div class="run-row__stats">
							{#if run.run_type === 'search'}
								{run.sources_found} kilder · {run.queries_run} queries · {run.raw_results} rå resultater
							{:else}
								{run.events_created} kladder
								{#if run.events_rejected > 0}
									· {run.events_rejected} filtreret fra{/if}
								{#if run.target_url}
									· {run.target_url}{/if}
							{/if}
						</div>
						<div class="run-row__time">
							{fmtDateTime(run.started_at)}{#if run.completed_at}
								→ {fmtDateTime(run.completed_at)}{/if}
						</div>
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

	.scraper__header {
		margin-bottom: 0.5rem;
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

	.scraper__header h1 {
		margin: 0 0 0.25rem;
	}
	.scraper__sub {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin: 0;
	}

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
		.search-grid {
			grid-template-columns: 1fr;
		}
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
		transition:
			background var(--transition-fast),
			opacity var(--transition-fast);
		align-self: center;
	}
	.btn-run:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.btn-run:not(:disabled):hover {
		background: var(--color-primary-dark, #0056b3);
		border-color: var(--color-primary-border);
	}
	.btn-run .material-symbols-outlined {
		font-size: 18px;
	}
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
	.status--ok {
		background: rgba(34, 197, 94, 0.1);
		color: #16a34a;
	}
	.status--err {
		background: rgba(239, 68, 68, 0.1);
		color: #dc2626;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		flex-shrink: 0;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

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

	.row--inactive {
		opacity: 0.55;
	}
	.row__main {
		flex: 1;
		min-width: 0;
	}

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
	.row__link:hover {
		text-decoration: underline;
	}
	.row__ext {
		font-size: 14px !important;
	}

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
	.badge--draft {
		background: rgba(124, 58, 237, 0.1);
		color: #7c3aed;
	}
	.badge--muted {
		background: var(--color-bg-muted);
		color: var(--color-text-muted);
	}

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
		transition:
			background var(--transition-fast),
			color var(--transition-fast);
	}
	.btn-icon:hover {
		background: var(--color-bg-muted);
		color: var(--color-text);
		text-decoration: none;
	}
	.btn-icon .material-symbols-outlined {
		font-size: 18px;
	}
	.btn-icon--danger {
		color: #ef4444;
	}
	.btn-icon--danger:hover {
		background: rgba(239, 68, 68, 0.08);
		color: #ef4444;
	}
	.btn-icon--edit:hover {
		color: var(--color-primary);
	}

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
	.btn-publish:hover {
		background: #16a34a;
	}
	.btn-publish .material-symbols-outlined {
		font-size: 15px;
	}

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

	.run-type,
	.run-status {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.15rem 0.5rem;
		border-radius: var(--border-radius-full);
		font-size: var(--font-size-xs);
		font-weight: 600;
	}
	.run-type .material-symbols-outlined,
	.run-status .material-symbols-outlined {
		font-size: 13px;
	}

	.run-type--search {
		background: rgba(59, 130, 246, 0.1);
		color: #2563eb;
	}
	.run-type--scrape {
		background: rgba(124, 58, 237, 0.1);
		color: #7c3aed;
	}
	.run-status--completed {
		background: rgba(34, 197, 94, 0.1);
		color: #16a34a;
	}
	.run-status--failed {
		background: rgba(239, 68, 68, 0.1);
		color: #dc2626;
	}
	.run-status--running {
		background: rgba(234, 179, 8, 0.1);
		color: #ca8a04;
	}

	.run-row__stats {
		color: var(--color-text-muted);
		font-size: var(--font-size-xs);
	}
	.run-row__time {
		margin-left: auto;
		color: var(--color-text-muted);
		font-size: var(--font-size-xs);
	}

	.run-row__error {
		width: 100%;
		margin: 0.25rem 0 0;
		font-size: var(--font-size-xs);
		color: #dc2626;
		font-family: monospace;
		background: rgba(239, 68, 68, 0.05);
		padding: 0.3rem 0.5rem;
		border-radius: var(--border-radius);
	}

	.run-row__error {
		white-space: pre-wrap;
	}

	/* ── Nye kontroller ── */
	.opt-grid {
		display: grid;
		grid-template-columns: 2fr 130px 130px;
		gap: 0.5rem;
		align-items: end;
	}
	.opt-grid--wide {
		grid-template-columns: 1fr 1fr 1fr;
	}

	@media (max-width: 900px) {
		.opt-grid,
		.opt-grid--wide {
			grid-template-columns: 1fr;
		}
	}

	.field select {
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius);
		background: var(--color-bg);
		color: inherit;
		padding: 0.45rem 0.55rem;
		font: inherit;
		font-size: var(--font-size-sm);
	}

	.field code {
		font-size: 0.9em;
		background: var(--color-bg-muted);
		padding: 0 0.2rem;
		border-radius: 3px;
	}

	.advanced {
		border: 1px solid var(--color-border-light);
		border-radius: var(--border-radius);
		padding: 0.5rem 0.75rem;
	}
	.advanced summary {
		cursor: pointer;
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text-muted);
	}
	.advanced[open] summary {
		margin-bottom: 0.6rem;
	}

	.toggles {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		cursor: pointer;
	}
	.toggle input {
		accent-color: var(--color-primary);
	}

	.btn-run--batch {
		background: #0891b2;
		border-color: #164e63;
	}
	.btn-run--batch:not(:disabled):hover {
		background: #0e7490;
		border-color: #164e63;
	}

	.status--warn {
		background: rgba(234, 179, 8, 0.12);
		color: #a16207;
	}

	.funnel {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-family: monospace;
	}

	.note {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		padding-left: 0.25rem;
		border-left: 2px solid var(--color-border);
	}

	.link-btn {
		align-self: flex-start;
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		font-size: var(--font-size-xs);
		color: var(--color-primary);
		text-decoration: underline;
		cursor: pointer;
	}

	.rejected {
		margin: 0;
		padding-left: 1.1rem;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.btn-danger-text {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.3rem 0.7rem;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius-full);
		font: inherit;
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: #ef4444;
		cursor: pointer;
	}
	.btn-danger-text:hover {
		background: rgba(239, 68, 68, 0.08);
	}
	.btn-danger-text .material-symbols-outlined {
		font-size: 15px;
	}

	/* ── Kilde-badges ── */
	.badge--kind {
		background: rgba(59, 130, 246, 0.12);
		color: #2563eb;
	}
	.badge--score {
		background: var(--color-bg-muted);
		color: var(--color-text-muted);
	}
	.badge--good {
		background: rgba(34, 197, 94, 0.12);
		color: #16a34a;
	}
	.badge--bad {
		background: rgba(239, 68, 68, 0.12);
		color: #dc2626;
	}

	.row__meta--strong {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		flex-wrap: wrap;
		color: var(--color-text);
		font-weight: 500;
	}
	.row__meta--strong .material-symbols-outlined {
		font-size: 14px;
	}

	.row__error {
		margin: 0.25rem 0 0;
		font-size: var(--font-size-xs);
		color: #dc2626;
		font-family: monospace;
		word-break: break-word;
	}

	.row__url--link {
		color: var(--color-primary);
		text-decoration: none;
		display: block;
	}
	.row__url--link:hover {
		text-decoration: underline;
	}

	/* ── Kladder ── */
	.draft-row {
		align-items: flex-start;
	}

	.draft-row__thumb {
		width: 88px;
		height: 66px;
		object-fit: cover;
		border-radius: var(--border-radius);
		flex-shrink: 0;
		background: var(--color-bg-muted);
	}

	.draft-row__desc {
		margin: 0.25rem 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		line-height: 1.4;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.draft-row__evidence {
		display: flex;
		align-items: flex-start;
		gap: 0.2rem;
		margin: 0.25rem 0;
		font-size: var(--font-size-xs);
		font-style: italic;
		color: var(--color-text-muted);
	}
	.draft-row__evidence .material-symbols-outlined {
		font-size: 13px;
		flex-shrink: 0;
	}

	.conf {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2rem;
		padding: 0.1rem 0.35rem;
		border-radius: var(--border-radius-full);
		font-size: var(--font-size-xs);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.conf--high {
		background: rgba(34, 197, 94, 0.15);
		color: #15803d;
	}
	.conf--mid {
		background: rgba(234, 179, 8, 0.15);
		color: #a16207;
	}
	.conf--low {
		background: rgba(239, 68, 68, 0.15);
		color: #dc2626;
	}
</style>
