<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import GallarySlider from '$lib/Shared/GallarySlider.svelte';

	let { data, form } = $props();
</script>

<section class="section section-welcome">
	<div class="hero-background">
		<div class="container hero-content">
			<h1 class="welcome-title">Welcome to SSBv1</h1>
			<p class="welcome-text">
				A Svelte 5 + SvelteKit + Supabase template for your next web application.
			</p>
			{#if data.activeGallery?.description}
				<p class="hero-gallery-description">{data.activeGallery.description}</p>
			{/if}
			{#if !data.user}
				<a href={resolve('/signup')} class="cta-button">Sign up</a>
			{/if}
		</div>
	</div>
</section>

<section class="section section-gallery">
	<div class="container">
		<h2>Featured gallery</h2>
		<GallarySlider galleryId={data.activeGallery?.id ?? 'mock-gallery'} images={data.galleryImages} />
	</div>
</section>

<section class="section section-booking-cta">
	<div class="container booking-cta-card">
		<div>
			<h2>Need a time slot?</h2>
			<p>Open the weekly calendar and reserve your seat in seconds.</p>
		</div>
		<a href={resolve('/booking')} class="cta-button">Book a seat</a>
	</div>
</section>

<section class="section section-blog">
	<div class="container">
		<h2>Recent posts</h2>
		<div class="blog-cards">
			{#if data.posts.length > 0}
				{#each data.posts as post (post.id)}
					<article class="blog-card">
						<h3>{post.title}</h3>
						<p class="blog-meta">
							{post.created_at ? new Date(post.created_at).toLocaleDateString() : ''}
						</p>
						<a href={resolve('/blog/[slug]', { slug: post.slug })} class="read-more">Read more...</a>
					</article>
				{/each}
			{:else}
				<p class="no-posts">
					No posts yet.{#if !data.user} Sign up and create your first post!{/if}
				</p>
			{/if}
		</div>
	</div>
</section>

<section class="section section-newsletter">
	<div class="container">
		<h2>Get newsletter</h2>
		<form
			method="POST"
			action="?/newsletter"
			use:enhance
			class="newsletter-form"
		>
			<label for="newsletter-email">Email</label>
			<input
				id="newsletter-email"
				name="email"
				type="email"
				placeholder="your@email.com"
				required
			/>
			<button type="submit" class="primary">Subscribe</button>
		</form>
		{#if form?.newsletterMessage}
			<p class="newsletter-message" class:success={form.newsletterSuccess}>
				{form.newsletterMessage}
			</p>
		{/if}
	</div>
</section>

<style>
	.section {
		margin: var(--section-margin) 0;
		padding: var(--section-padding) 0;
	}

	.section-welcome {
		padding: 0;
		margin-top: 0;
	}

	.hero-background {
		padding: 3rem 0;
		background:
			linear-gradient(130deg, rgb(37 99 235 / 12%), rgb(26 26 26 / 6%)),
			radial-gradient(circle at 15% 20%, rgb(37 99 235 / 22%), transparent 60%),
			radial-gradient(circle at 85% 70%, rgb(29 78 216 / 20%), transparent 65%);
		border-radius: var(--border-radius-lg);
	}

	.hero-content {
		text-align: center;
	}

	.welcome-title {
		font-size: var(--font-size-3xl);
		margin-bottom: 0.5rem;
	}

	.welcome-text {
		margin-bottom: 1.5rem;
		color: var(--color-text-muted);
	}

	.hero-gallery-description {
		max-width: 52rem;
		margin: 0 auto 1.5rem;
		color: var(--color-text-muted);
	}

	.cta-button {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		background: var(--color-accent);
		color: white;
		border-radius: var(--border-radius);
		text-decoration: none;
		font-weight: 500;
	}

	.cta-button:hover {
		background: var(--color-accent-hover);
		text-decoration: none;
	}

	.blog-cards {
		display: flex;
		flex-wrap: wrap;
		gap: var(--card-margin);
	}

	.booking-cta-card {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: var(--card-padding);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
		background: var(--color-bg-muted);
	}

	.section-gallery h2 {
		margin-bottom: 0.75rem;
	}

	.blog-card {
		flex: 1 1 100%;
		min-width: 240px;
		padding: var(--card-padding);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
		background: var(--color-bg);
	}

	@media (min-width: 768px) {
		.blog-card {
			flex: 1 1 calc(33.333% - var(--card-margin) * 2);
		}
	}

	.blog-card h3 {
		margin: 0 0 0.25rem;
		font-size: var(--font-size-lg);
	}

	.blog-meta {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin: 0 0 0.5rem;
	}

	.read-more {
		display: inline-block;
		margin-top: 0.5rem;
	}

	.no-posts {
		color: var(--color-text-muted);
		margin: 0;
	}

	.newsletter-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: stretch;
		max-width: 24rem;
	}

	.newsletter-form label {
		display: none;
	}

	.newsletter-form input {
		flex: 1;
		min-width: 12rem;
		height: 2.5rem;
		margin: 0;
		box-sizing: border-box;
	}

	.newsletter-form button {
		height: 2.5rem;
		margin: 0;
		padding: 0 1rem;
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
	}

	.newsletter-message {
		margin: 0.5rem 0 0;
		font-size: var(--font-size-sm);
	}

	.newsletter-message.success {
		color: var(--color-success);
	}
</style>
