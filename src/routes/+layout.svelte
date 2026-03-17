<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';
	import CookieConsent from '$lib/Shared/CookieConsent.svelte';
	import DonateButton from '$lib/Shared/DonateButton.svelte';
	import ChatWidget from '$lib/Shared/ChatWidget.svelte';

	let { data, children } = $props();

	type Crumb = {
		label: string;
		path: string | null;
	};

	const pathname = $derived(page.url.pathname);
	const segments = $derived(pathname.split('/').filter(Boolean));
	const activeSection = $derived(
		segments[0] === 'blog'
			? 'blog'
			: segments[0] === 'admin'
				? 'admin'
			: segments[0] === 'booking'
				? 'booking'
			: segments[0] === 'profile' || segments[0] === 'team'
				? 'profile'
				: 'home'
	);
	const displayName = $derived(data.user?.user_metadata?.display_name ?? data.user?.email ?? 'Profile');

	const sidebarLinks = $derived.by(() => {
		if (activeSection === 'blog') {
			const links = [{ label: 'All posts', path: '/blog' }];
			if (data.user) {
				links.push({ label: 'New post', path: '/blog/new' });
				links.push({ label: 'Edit my posts', path: '/blog/edit' });
			}
			return links;
		}

		if (activeSection === 'profile') {
			const links = [{ label: 'Profile', path: '/profile' }];
			if (data.user) {
				links.push({ label: 'Edit profile', path: '/profile/edit' });
				links.push({ label: 'Team manager', path: '/team' });
			}
			return links;
		}

		if (activeSection === 'admin') {
			return [
				{ label: 'Admin home', path: '/admin' },
				{ label: 'Gallary', path: '/admin/gallary' },
				{ label: 'Bookings', path: '/admin/bookings' }
			];
		}

		if (activeSection === 'booking') {
			return [{ label: 'Booking', path: '/booking' }];
		}

		return [
			{ label: 'Home', path: '/' },
			{ label: 'Blog', path: '/blog' },
			{ label: 'Booking', path: '/booking' },
			...(data.user ? [{ label: 'Profile', path: '/profile' }, { label: 'Admin', path: '/admin' }] : [])
		];
	});

	const breadcrumbs = $derived.by(() => {
		const trail: Crumb[] = [{ label: 'home', path: '/' }];
		if (segments.length === 0) return trail;

		if (segments[0] === 'team') {
			trail.push({ label: 'profile', path: '/profile' });
		}

		let cumulative = '';
		for (let i = 0; i < segments.length; i += 1) {
			const segment = segments[i];
			cumulative += `/${segment}`;
			const isLast = i === segments.length - 1;

			let label = segment;
			if (segment === 'blog') label = 'blog';
			else if (segment === 'profile') label = 'profile';
			else if (segment === 'team') label = 'teams';
			else if (segment === 'admin') label = 'admin';
			else if (segment === 'booking' || segment === 'bookings') label = 'booking';
			else if (segment === 'edit') label = 'edit';
			else if (segment === 'new') label = 'new';
			else label = decodeURIComponent(segment).replace(/-/g, ' ');

			const alreadyAdded = trail.some((item) => item.label === label && item.path === (isLast ? null : cumulative));
			if (!alreadyAdded) {
				trail.push({ label, path: isLast ? null : cumulative });
			}
		}

		return trail;
	});

	function isSidebarLinkSelected(path: string) {
		if (path === '/') return pathname === '/';
		if (path === '/admin') return pathname === '/admin';
		return pathname === path || pathname.startsWith(`${path}/`);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div id="app" class="app">
	<header class="header">
		<a href={resolve('/')} class="logo">SSBv1</a>
		<nav class="nav">
			<a href={resolve('/')} class:active={activeSection === 'home'}>Home</a>
			<span class="nav-separator">|</span>
			<a href={resolve('/blog')} class:active={activeSection === 'blog'}>Blog</a>
			<span class="nav-separator">|</span>
			<a href={resolve('/booking')} class:active={activeSection === 'booking'}>Booking</a>
			{#if data.user}
				<span class="nav-separator">|</span>
				<a href={resolve('/admin')} class:active={activeSection === 'admin'}>Admin</a>
				<span class="nav-separator">|</span>
				<details class="profile-menu">
					<summary class:active={activeSection === 'profile'}>hi! {displayName}</summary>
					<div class="profile-menu-list">
						<a href={resolve('/profile')}>Profile</a>
						<a href={resolve('/team')}>Team manager</a>
						<form method="POST" action={resolve('/logout')} class="dropdown-logout-form">
							<button type="submit">Logout</button>
						</form>
					</div>
				</details>
			{:else}
				<span class="nav-separator">|</span>
				<a href={resolve('/login')}>Log in</a>
				<a href={resolve('/signup')}>Sign up</a>
			{/if}
		</nav>
	</header>

	<div class="main-wrapper">
		<aside class="sidebar">
			<nav class="sidebar-nav">
				{#each sidebarLinks as link (`${link.path}-${link.label}`)}
					<button
						type="button"
						class="nav-link-button"
						class:selected={isSidebarLinkSelected(link.path)}
						aria-current={isSidebarLinkSelected(link.path) ? 'page' : undefined}
						onclick={() => goto(resolve(link.path as any))}
					>
						{link.label}
					</button>
				{/each}
			</nav>
			{#if data.user}
				<section class="my-bookings-card">
					<h3>My bookings</h3>
					{#if data.myBookings && data.myBookings.length > 0}
						<ul>
							{#each data.myBookings as booking (booking.id)}
								<li>
									<strong>{booking.bookable_name}</strong>
									<span>{booking.booking_date} {booking.timeslot}</span>
								</li>
							{/each}
						</ul>
						<a href={resolve('/booking')}>Open booking</a>
					{:else}
						<p>No bookings yet.</p>
					{/if}
				</section>
			{/if}
		</aside>

		<div class="content-column">
			{#if pathname !== '/'}
				<nav class="breadcrumbs" aria-label="Breadcrumb">
					{#each breadcrumbs as crumb, i (crumb.path ?? `${crumb.label}-${i}`)}
						{#if i > 0}
							<span aria-hidden="true"> &gt; </span>
						{/if}
						{#if crumb.path}
							<button
								type="button"
								class="crumb-link-button"
								onclick={() => goto(resolve(crumb.path as any))}
							>
								{crumb.label}
							</button>
						{:else}
							<span class="current">{crumb.label}</span>
						{/if}
					{/each}
				</nav>
			{/if}
			<main class="main" class:flush-content={pathname.startsWith('/admin/gallary')}>
				{@render children()}
			</main>
		</div>
	</div>

	<footer class="footer">
		<span class="footer-text">SSBv1 Template</span>
		<DonateButton />
	</footer>
	<CookieConsent />
	<ChatWidget />
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--section-padding);
		border-bottom: var(--border-width) solid var(--color-border);
		flex-shrink: 0;
	}

	.logo {
		font-size: var(--font-size-xl);
		font-weight: 600;
		color: var(--color-text);
		text-decoration: none;
	}

	.logo:hover {
		color: var(--color-accent);
		text-decoration: none;
	}

	.nav {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.nav a {
		text-decoration: none;
	}

	.nav a.active {
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.nav-separator {
		color: var(--color-text-muted);
	}

	.profile-menu {
		position: relative;
	}

	.profile-menu summary {
		list-style: none;
		cursor: pointer;
	}

	.profile-menu summary::-webkit-details-marker {
		display: none;
	}

	.profile-menu summary.active {
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.profile-menu-list {
		position: absolute;
		top: calc(100% + 0.4rem);
		right: 0;
		min-width: 11rem;
		display: grid;
		gap: 0.25rem;
		padding: 0.4rem;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius-sm);
		background: var(--color-bg);
		z-index: 20;
	}

	.profile-menu-list a,
	.profile-menu-list button {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.35rem 0.5rem;
		background: transparent;
		border: none;
		border-radius: var(--border-radius-sm);
		font: inherit;
		color: inherit;
		text-decoration: none;
		cursor: pointer;
	}

	.profile-menu-list a:hover,
	.profile-menu-list button:hover {
		background: var(--color-bg-muted);
	}

	.dropdown-logout-form {
		margin: 0;
	}

	.main-wrapper {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.sidebar {
		flex-shrink: 0;
		width: 12rem;
		border-right: var(--border-width) solid var(--color-border);
		padding: var(--section-padding);
	}

	.sidebar-nav {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.my-bookings-card {
		margin-top: 1rem;
		padding-top: 0.75rem;
		border-top: var(--border-width) solid var(--color-border);
		display: grid;
		gap: 0.5rem;
	}

	.my-bookings-card h3 {
		margin: 0;
		font-size: var(--font-size-sm);
	}

	.my-bookings-card ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.35rem;
	}

	.my-bookings-card li {
		display: grid;
		font-size: var(--font-size-sm);
	}

	.my-bookings-card li span {
		color: var(--color-text-muted);
	}

	.my-bookings-card p {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.nav-link-button {
		background: transparent;
		border: none;
		padding: 0.25rem 0;
		margin: 0;
		text-align: left;
		font: inherit;
		color: var(--color-accent);
		cursor: pointer;
	}

	.nav-link-button.selected {
		color: var(--color-text);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.nav-link-button:hover {
		text-decoration: underline;
	}

	.content-column {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.breadcrumbs {
		padding: 0.45rem var(--section-padding);
		border-bottom: var(--border-width) solid var(--color-border);
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		white-space: nowrap;
		overflow-x: auto;
	}

	.crumb-link-button {
		background: transparent;
		border: none;
		padding: 0;
		margin: 0;
		font: inherit;
		color: inherit;
		cursor: pointer;
	}

	.crumb-link-button:hover {
		text-decoration: underline;
	}

	.breadcrumbs .current {
		color: var(--color-text);
		font-weight: 600;
	}

	.main {
		flex: 1;
		overflow-y: auto;
		padding: var(--section-padding);
	}

	.main.flush-content {
		padding: 0;
	}

	.footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem var(--section-padding);
		border-top: var(--border-width) solid var(--color-border);
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.footer-text {
		margin: 0;
	}

	@media (max-width: 767px) {
		.sidebar {
			width: 8rem;
		}
	}

	@media (max-width: 479px) {
		.sidebar {
			width: 6rem;
		}
	}
</style>
