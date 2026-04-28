<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CookieConsent from '$lib/Shared/CookieConsent.svelte';

	let { data, children } = $props();

	let mobileMenuOpen = $state(false);
	let profileMenuOpen = $state(false);
	const PROFILE_MENU_ID = 'desktop-profile-menu';

	const pathname = $derived(page.url.pathname);
	const segments = $derived(pathname.split('/').filter(Boolean));
	const activeSection = $derived(
		segments[0] === 'tours'
			? 'tours'
			: segments[0] === 'blog'
				? 'blog'
				: segments[0] === 'community'
					? 'community'
					: segments[0] === 'marketplace'
						? 'marketplace'
						: segments[0] === 'admin'
							? 'admin'
							: segments[0] === 'profile' || segments[0] === 'team'
								? 'profile'
								: 'home'
	);
	const displayName = $derived(data.profileDisplayName ?? data.user?.user_metadata?.display_name ?? data.user?.email ?? 'Profile');

	// Check if current page is a full-bleed page (no sidebar layout)
	const isFullBleedPage = $derived(
		activeSection === 'tours' || activeSection === 'home' || activeSection === 'marketplace'
	);

	function closeProfileMenu() {
		profileMenuOpen = false;
	}

	function handleWindowPointerDown(event: PointerEvent) {
		if (!profileMenuOpen) return;
		const profileMenuEl = document.getElementById(PROFILE_MENU_ID);
		if (!profileMenuEl) return;
		const target = event.target;
		if (target instanceof Node && !profileMenuEl.contains(target)) {
			closeProfileMenu();
		}
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') closeProfileMenu();
	}
</script>

<svelte:head>
	<title>SUP Tours — Find Your Next Paddle Adventure</title>
	<meta name="description" content="Plan, find, share, and join Stand Up Paddle tours across Denmark and beyond." />
</svelte:head>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeydown} />

<div id="app" class="app">
	<!-- Desktop Header -->
	<header class="header">
		<a href={resolve('/')} class="logo">
			<span class="logo-brand">SUP Tours</span>
			<span class="logo-sub">Denmark! Lets go!</span>
		</a>

		<nav class="nav-desktop">
			<a href={resolve('/')} class="nav-link" class:active={activeSection === 'home'}>Home</a>
			<a href={resolve('/tours')} class="nav-link" class:active={activeSection === 'tours'}>Tours</a>
			<a href={resolve('/community')} class="nav-link" class:active={activeSection === 'community'}>Community</a>
			<a href={resolve('/marketplace')} class="nav-link" class:active={activeSection === 'marketplace'}>Market</a>
			<a href={resolve('/blog')} class="nav-link" class:active={activeSection === 'blog'}>Blog</a>
			{#if data.user}
				<details id={PROFILE_MENU_ID} class="profile-menu" bind:open={profileMenuOpen}>
					<summary class="nav-link" class:active={activeSection === 'profile'}>
						{#if data.profileAvatarUrl}
							<img src={data.profileAvatarUrl} alt="" class="profile-avatar profile-avatar--xs" />
						{:else}
							<span class="material-symbols-outlined" style="font-size:20px;vertical-align:middle">account_circle</span>
						{/if}
						{displayName}
					</summary>
					<div class="profile-menu-list">
						<a href={resolve('/profile')} onclick={closeProfileMenu}>Profile</a>
						<a href={resolve('/team')} onclick={closeProfileMenu}>Team manager</a>
						{#if data.isAdmin}
							<a href={resolve('/admin')} onclick={closeProfileMenu}>Admin</a>
						{/if}
						<hr />
						<form method="POST" action={resolve('/logout')} class="dropdown-logout-form">
							<button type="submit" onclick={closeProfileMenu}>Log out</button>
						</form>
					</div>
				</details>
			{:else}
				<a href={resolve('/login')} class="nav-link">Log in</a>
				<a href={resolve('/signup')} class="btn-primary-sm">Sign up</a>
			{/if}
		</nav>

		<!-- Mobile hamburger -->
		<button class="hamburger" onclick={() => mobileMenuOpen = !mobileMenuOpen} aria-label="Toggle menu">
			<span class="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
		</button>
	</header>

	<!-- Mobile dropdown menu -->
	{#if mobileMenuOpen}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="mobile-overlay" onclick={() => mobileMenuOpen = false} onkeydown={() => {}}></div>
		<nav class="mobile-menu">
			<a href={resolve('/')} onclick={() => mobileMenuOpen = false} aria-label="Go to Home">Home</a>
			<a href={resolve('/tours')} onclick={() => mobileMenuOpen = false} aria-label="Go to Tours">Tours</a>
			<a href={resolve('/community')} onclick={() => mobileMenuOpen = false} aria-label="Go to Community">Community</a>
			<a href={resolve('/marketplace')} onclick={() => mobileMenuOpen = false} aria-label="Go to Market">Market</a>
			<a href={resolve('/blog')} onclick={() => mobileMenuOpen = false} aria-label="Go to Blog">Blog</a>
			<hr />
			{#if data.user}
				<a href={resolve('/profile')} onclick={() => mobileMenuOpen = false} aria-label="Go to Profile">Profile</a>
				{#if data.isAdmin}
					<a href={resolve('/admin')} onclick={() => mobileMenuOpen = false} aria-label="Go to Admin">Admin</a>
				{/if}
				<form method="POST" action={resolve('/logout')}>
					<button type="submit" aria-label="Log out">Log out</button>
				</form>
			{:else}
				<a href={resolve('/login')} onclick={() => mobileMenuOpen = false} aria-label="Go to Log in">Log in</a>
				<a href={resolve('/signup')} onclick={() => mobileMenuOpen = false} aria-label="Go to Sign up">Sign up</a>
			{/if}
		</nav>
	{/if}

	<!-- Main content -->
	<main class="main-content" class:full-bleed={isFullBleedPage}>
		{@render children()}
	</main>

	<!-- Footer (hidden on mobile when bottom nav shows) -->
	<footer class="footer">
		<div class="footer-grid container">
			<!-- Column 1: Not US Big Tech -->
			<div class="footer-section footer-trust">
				{#if data.homeTrustImageUrl}
					<div class="footer-trust__media">
						<img src={data.homeTrustImageUrl} alt="" loading="lazy" />
					</div>
				{/if}
				<div class="footer-trust__content">
					<p class="footer-trust__label">Not US Big Tech</p>
					<h3 class="footer-trust__title">Built for paddlers, not ad markets</h3>
					<p class="footer-trust__text">
						SUP Tours is independent, community-led software for finding water time in Denmark—without the surveillance-ad playbook.
					</p>
				</div>
			</div>

			<!-- Column 2: Om os -->
			<div class="footer-section">
				<h3 class="footer-section__title">Hvem er vi?</h3>
				<p class="footer-section__text">
					Vi er et uafhængigt fællesskab af paddlere, der elsker vandet. 
					Vores platform er skabt til at gøre det nemt at finde og dele SUP-oplevelser.
				</p>
				<nav class="footer-nav">
					<a href={resolve('/about')}>Læs om os</a>
					<a href={resolve('/blog')}>Vores Blog</a>
					<a href={resolve('/community')}>Community</a>
				</nav>
			</div>

			<!-- Column 3: Info & Links -->
			<div class="footer-section">
				<h3 class="footer-section__title">Gå til</h3>
				<nav class="footer-nav">
					<a href={resolve('/terms')}>Betingelser</a>
					<a href={resolve('/marketplace')}>Market</a>
					<a href={resolve('/tours')}>Find Ture</a>
				</nav>
				<div class="footer-bottom-brand">
					<span class="footer-brand">SUP Tours</span>
					<p class="footer-copyright">2026 &copy; Uafhængig & Fællesskabsdrevet</p>
				</div>
			</div>
		</div>
	</footer>

	<!-- Mobile Bottom Navigation -->
	<nav class="bottom-nav">
		<a href={resolve('/tours')} class="bottom-nav-item" class:active={activeSection === 'tours'} aria-label="Open Tours">
			<span class="material-symbols-outlined">calendar_month</span>
			<span class="bottom-nav-label">Tours</span>
		</a>
		<a href={resolve('/')} class="bottom-nav-item" class:active={activeSection === 'home'} aria-label="Open Explore">
			<span class="material-symbols-outlined">explore</span>
			<span class="bottom-nav-label">Explore</span>
		</a>
		{#if data.user}
			<a href={resolve('/tours/new')} class="bottom-nav-item bottom-nav-fab" aria-label="Create new tour">
				<span class="material-symbols-outlined">add</span>
			</a>
		{/if}
		<a href={resolve('/community')} class="bottom-nav-item" class:active={activeSection === 'community'} aria-label="Open Community">
			<span class="material-symbols-outlined">forum</span>
			<span class="bottom-nav-label">Community</span>
		</a>
		<a
			href={data.user ? resolve('/profile') : `${resolve('/login')}?next=%2Fprofile`}
			class="bottom-nav-item"
			class:active={activeSection === 'profile'}
			aria-label={data.user ? 'Open Profile' : 'Open Log in'}
		>
			{#if data.user && data.profileAvatarUrl}
				<img src={data.profileAvatarUrl} alt="" class="bottom-nav-avatar" />
			{:else}
				<span class="material-symbols-outlined">account_circle</span>
			{/if}
			<span class="bottom-nav-label">{data.user ? 'Profile' : 'Log in'}</span>
		</a>
	</nav>

	<CookieConsent />
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background: var(--color-bg);
	}

	/* ---- HEADER ---- */
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem var(--section-padding);
		background: var(--color-surface);
		border-bottom: var(--border-width) solid var(--color-border);
		position: sticky;
		top: 0;
		z-index: 240;
	}

	.logo {
		display: flex;
		flex-direction: column;
		text-decoration: none;
		line-height: 1.1;
	}

	.logo:hover { text-decoration: none; }

	.logo-brand {
		font-size: var(--font-size-xl);
		font-weight: 700;
		color: var(--color-text);
		letter-spacing: -0.02em;
	}

	.logo-sub {
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--color-primary);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	/* ---- DESKTOP NAV ---- */
	.nav-desktop {
		display: none;
		gap: 0.25rem;
		align-items: center;
	}

	.nav-link {
		padding: 0.4rem 0.75rem;
		color: var(--color-text);
		text-decoration: none;
		font-size: var(--font-size-sm);
		font-weight: 500;
		border-radius: var(--border-radius);
		transition: background var(--transition-fast), color var(--transition-fast);
	}

	.nav-link:hover {
		background: var(--color-bg-muted);
		text-decoration: none;
		color: var(--color-primary);
	}

	.nav-link.active {
		color: var(--color-primary);
		background: var(--color-primary-light);
	}

	.btn-primary-sm {
		display: inline-flex;
		align-items: center;
		padding: 0.4rem 1rem;
		background: var(--color-primary);
		color: var(--color-text-light);
		font-size: var(--font-size-sm);
		font-weight: 600;
		border: 1px solid var(--color-primary-border);
		border-radius: var(--border-radius-full);
		text-decoration: none;
		transition: background var(--transition-fast);
	}

	.btn-primary-sm:hover {
		background: var(--color-primary-dark);
		border-color: var(--color-primary-border);
		text-decoration: none;
	}

	/* Profile dropdown */
	.profile-menu {
		position: relative;
		z-index: 2;
	}

	.profile-menu summary {
		list-style: none;
		cursor: pointer;
		display: inline-grid;
		grid-template-columns: 2.35rem auto;
		align-items: center;
		gap: 0.55rem;
		min-width: 10rem;
		padding: 0.15rem 0.75rem 0.15rem 0.15rem;
	}

	.profile-menu summary::-webkit-details-marker { display: none; }

	.profile-avatar {
		display: inline-block;
		object-fit: cover;
		border-radius: var(--border-radius-full);
		border: 1px solid var(--color-border);
		background: var(--color-bg-muted);
		flex-shrink: 0;
	}

	.profile-avatar--xs {
		width: 2.35rem;
		height: 2.35rem;
		border-radius: calc(var(--border-radius-sm) - 1px);
		border: none;
	}

	.profile-menu-list {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		min-width: 12rem;
		display: grid;
		gap: 0.125rem;
		padding: 0.5rem;
		background: var(--color-surface);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius-lg);
		box-shadow: var(--shadow-lg);
		z-index: 280;
	}

	.profile-menu-list a,
	.profile-menu-list button {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.5rem 0.75rem;
		background: transparent;
		border: none;
		border-radius: var(--border-radius-sm);
		font: inherit;
		font-size: var(--font-size-sm);
		color: var(--color-text);
		text-decoration: none;
		cursor: pointer;
	}

	.profile-menu-list a:hover,
	.profile-menu-list button:hover {
		background: var(--color-bg-muted);
		color: var(--color-primary);
	}

	.profile-menu-list hr {
		border: none;
		border-top: var(--border-width) solid var(--color-border);
		margin: 0.25rem 0;
	}

	.dropdown-logout-form { margin: 0; }

	/* ---- HAMBURGER ---- */
	.hamburger {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		background: var(--color-surface);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
		cursor: pointer;
		color: var(--color-text);
	}

	/* ---- MOBILE MENU ---- */
	.mobile-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		z-index: 90;
	}

	.mobile-menu {
		position: fixed;
		top: 0;
		right: 0;
		width: 16rem;
		height: 100vh;
		background: var(--color-surface);
		padding: 4.5rem 1.5rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		z-index: 95;
		box-shadow: var(--shadow-lg);
		overflow-y: auto;
	}

	.mobile-menu a,
	.mobile-menu button {
		display: block;
		padding: 0.75rem 0.5rem;
		text-decoration: none;
		color: var(--color-text);
		font-weight: 500;
		border: none;
		background: none;
		font: inherit;
		font-size: var(--font-size-base);
		text-align: left;
		cursor: pointer;
		border-radius: var(--border-radius-sm);
	}

	.mobile-menu a:hover,
	.mobile-menu button:hover {
		background: var(--color-bg-muted);
		color: var(--color-primary);
	}

	.mobile-menu hr {
		border: none;
		border-top: var(--border-width) solid var(--color-border);
		margin: 0.5rem 0;
	}

	.mobile-menu form { margin: 0; }

	/* ---- MAIN CONTENT ---- */
	.main-content {
		flex: 1;
		padding: var(--section-padding);
		padding-bottom: 6rem; /* space for bottom nav on mobile */
	}

	.main-content.full-bleed {
		padding: 0;
		padding-bottom: 5rem;
	}

	/* ---- FOOTER ---- */
	.footer {
		border-top: var(--border-width) solid var(--color-border);
		background: #1e293b;
		color: #f1f5f9;
		padding: 3.5rem var(--section-padding);
	}

	.footer-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 3rem;
		max-width: 64rem;
		margin: 0 auto;
	}

	@media (min-width: 768px) {
		.footer-grid {
			grid-template-columns: 1.5fr 1fr 1fr;
			gap: 2rem;
		}
	}

	.footer-section__title {
		font-size: var(--font-size-base);
		font-weight: 700;
		color: #ffffff;
		margin-bottom: 1.25rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.footer-section__text {
		font-size: var(--font-size-sm);
		color: #cbd5e1;
		line-height: 1.6;
		margin-bottom: 1.5rem;
	}

	.footer-nav {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.footer-nav a {
		color: #94a3b8;
		text-decoration: none;
		font-size: var(--font-size-sm);
		transition: color var(--transition-fast);
	}

	.footer-nav a:hover {
		color: #ffffff;
	}

	/* Footer Trust Section (Not US Big Tech) */
	.footer-trust {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.footer-trust__media {
		width: 100%;
		max-width: 18rem;
		border-radius: var(--border-radius);
		overflow: hidden;
		border: 1px solid rgba(234, 88, 12, 0.3);
		background: #2a3038;
	}

	.footer-trust__media img {
		display: block;
		width: 100%;
		height: auto;
		max-height: 8rem;
		object-fit: cover;
	}

	.footer-trust__label {
		display: inline-block;
		margin-bottom: 0.75rem;
		padding: 0.2rem 0.6rem;
		background: rgba(234, 88, 12, 0.15);
		color: #fb923c;
		border: 1px solid #ea580c;
		font-size: 10px;
		font-weight: 700;
		border-radius: var(--border-radius-full);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.footer-trust__title {
		font-size: var(--font-size-base);
		font-weight: 700;
		color: #ffffff;
		margin-bottom: 0.5rem;
	}

	.footer-trust__text {
		font-size: 13px;
		color: #94a3b8;
		line-height: 1.5;
	}

	.footer-bottom-brand {
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 1px solid #334155;
	}

	.footer-brand {
		font-size: var(--font-size-lg);
		font-weight: 700;
		color: #ffffff;
		display: block;
		margin-bottom: 0.25rem;
	}

	.footer-copyright {
		font-size: 12px;
		color: #64748b;
	}

	/* ---- BOTTOM NAV (mobile) ---- */
	.bottom-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: space-around;
		align-items: center;
		background: var(--color-surface);
		border-top: var(--border-width) solid var(--color-border);
		padding: 0.4rem 0 max(0.4rem, env(safe-area-inset-bottom));
		z-index: 80;
	}

	.bottom-nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		padding: 0.25rem 0.75rem;
		color: var(--color-text-muted);
		text-decoration: none;
		font-size: var(--font-size-xs);
		transition: color var(--transition-fast);
	}

	.bottom-nav-item:hover { text-decoration: none; }

	.bottom-nav-item.active {
		color: var(--color-primary);
	}

	.bottom-nav-item .material-symbols-outlined {
		font-size: 24px;
	}

	.bottom-nav-avatar {
		width: 24px;
		height: 24px;
		display: block;
		object-fit: cover;
		border-radius: var(--border-radius-full);
		border: 1px solid var(--color-border);
		background: var(--color-bg-muted);
	}

	.bottom-nav-label {
		font-weight: 500;
	}

	.bottom-nav-fab {
		position: relative;
		top: -0.75rem;
		width: 3rem;
		height: 3rem;
		border: 1px solid var(--color-primary-border);
		border-radius: var(--border-radius-full);
		background: var(--color-primary);
		color: var(--color-text-light);
		justify-content: center;
		box-shadow: var(--shadow-primary);
		padding: 0;
	}

	.bottom-nav-fab .material-symbols-outlined {
		font-size: 28px;
	}

	.bottom-nav-fab:hover {
		background: var(--color-primary-dark);
		border-color: var(--color-primary-border);
	}

	/* ---- RESPONSIVE ---- */
	@media (min-width: 768px) {
		.hamburger { display: none; }
		.nav-desktop { display: flex; }
		.bottom-nav { display: none; }
		.footer { display: block; }

		.main-content {
			padding-bottom: var(--section-padding);
		}

		.main-content.full-bleed {
			padding-bottom: 0;
		}
	}

	@media (max-width: 767px) {
		.footer { display: none; }
	}
</style>

