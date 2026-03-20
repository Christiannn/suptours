<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import GallarySlider from '$lib/Shared/GallarySlider.svelte';
	import { getTourShowSlug } from '$lib/tours/tourShowSlug';

	let { data, form } = $props();
</script>

<!-- Hero Section -->
<section class="hero">
	<div class="hero__bg"></div>
	<div class="hero__content">
		<span class="hero__badge">Denmark & Beyond</span>
		<h1 class="hero__title">Find Your Next<br/>SUP Adventure</h1>
		<p class="hero__text">
			Plan, discover, and join stand up paddle tours with an amazing community
			of water lovers across Europe.
		</p>
		<div class="hero__actions">
			<a href={resolve('/tours')} class="hero__btn hero__btn--primary">
				<span class="material-symbols-outlined">explore</span>
				Browse Tours
			</a>
			{#if !data.user}
				<a href={resolve('/signup')} class="hero__btn hero__btn--secondary">
					Get Started
				</a>
			{:else}
				<a href={resolve('/tours/new')} class="hero__btn hero__btn--secondary">
					Create a Tour
				</a>
			{/if}
		</div>
	</div>
</section>

<!-- Featured Tours -->
{#if data.featuredTours.length > 0}
	<section class="section">
		<div class="container">
			<div class="section__header">
				<h2 class="section__title">Upcoming Tours</h2>
				<a href={resolve('/tours')} class="section__link">See all →</a>
			</div>
			<div class="featured-tours">
				{#each data.featuredTours as tour (tour.id)}
					<a
						href="{resolve('/tours')}?show={encodeURIComponent(getTourShowSlug(tour))}"
						class="featured-tour-card"
					>
						<div class="featured-tour-card__image-wrap">
							<img
								src={tour.image_url || 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=400&q=80'}
								alt={tour.title}
								class="featured-tour-card__image"
								loading="lazy"
							/>
							<div class="featured-tour-card__overlay"></div>
							<span class="featured-tour-card__date">
								{new Date(tour.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
							</span>
						</div>
						<div class="featured-tour-card__body">
							<h3>{tour.title}</h3>
							{#if tour.locality}
								<p class="featured-tour-card__location">
									<span class="material-symbols-outlined" style="font-size:16px">location_on</span>
									{tour.locality}
								</p>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		</div>
	</section>
{/if}

<!-- Recent Reviews -->
{#if data.recentReviews.length > 0}
	<section class="section section--muted">
		<div class="container">
			<h2 class="section__title">What Paddlers Say</h2>
			<div class="reviews-grid">
				{#each data.recentReviews as review (review.id)}
					<div class="review-card">
						{#if review.image_url}
							<div class="review-card__photo">
								<img src={review.image_url} alt="" loading="lazy" />
							</div>
						{/if}
						<div class="review-card__stars">
							{#each Array(5) as _, i}
								<span class="material-symbols-outlined review-star" class:review-star--filled={i < review.rating_display}>
									star
								</span>
							{/each}
						</div>
						{#if review.comment}
							<p class="review-card__comment">"{review.comment}"</p>
						{/if}
						<p class="review-card__author">— {review.reviewer_name}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>
{/if}

<!-- Gallery -->
<section class="section">
	<div class="container">
		<h2 class="section__title">From the Water</h2>
		<GallarySlider galleryId={data.activeGallery?.id ?? 'mock-gallery'} images={data.galleryImages} />
	</div>
</section>

<!-- Blog -->
{#if data.posts.length > 0}
	<section class="section">
		<div class="container">
			<div class="section__header">
				<h2 class="section__title">Latest Stories</h2>
				<a href={resolve('/blog')} class="section__link">All posts →</a>
			</div>
			<div class="blog-cards">
				{#each data.posts as post (post.id)}
					<article class="blog-card">
						<h3>{post.title}</h3>
						<p class="blog-meta">
							{post.created_at ? new Date(post.created_at).toLocaleDateString() : ''}
						</p>
						<a href={resolve('/blog/[slug]', { slug: post.slug })} class="read-more">Read more →</a>
					</article>
				{/each}
			</div>
		</div>
	</section>
{/if}

<!-- CTA: Create Tour -->
<section class="section section--cta">
	<div class="container cta-card">
		<span class="material-symbols-outlined cta-card__icon">kayaking</span>
		<h2>Got a Favorite Spot?</h2>
		<p>Create your own SUP tour and invite the community to join you on the water!</p>
		<a href={resolve(data.user ? '/tours/new' : '/signup')} class="cta-card__btn">
			{data.user ? 'Create a Tour' : 'Sign Up & Create'}
		</a>
	</div>
</section>

<!-- Newsletter -->
<section class="section section--muted">
	<div class="container newsletter-section">
		<h2 class="section__title">Stay in the Loop</h2>
		<p class="newsletter-text">Get notified about new tours and community events.</p>
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
	/* ---- HERO ---- */
	.hero {
		position: relative;
		padding: 3rem 1.5rem 4rem;
		overflow: hidden;
	}

	.hero__bg {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(160deg, rgba(19, 200, 236, 0.15) 0%, rgba(245, 239, 230, 0.3) 40%, rgba(19, 200, 236, 0.08) 100%),
			radial-gradient(circle at 20% 30%, rgba(19, 200, 236, 0.25), transparent 60%),
			radial-gradient(circle at 80% 70%, rgba(14, 165, 198, 0.15), transparent 65%);
		z-index: 0;
	}

	.hero__content {
		position: relative;
		z-index: 1;
		text-align: center;
		max-width: 32rem;
		margin: 0 auto;
	}

	.hero__badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		background: var(--color-primary);
		color: white;
		font-size: var(--font-size-xs);
		font-weight: 700;
		border-radius: var(--border-radius-full);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-bottom: 1rem;
	}

	.hero__title {
		margin: 0 0 0.75rem;
		font-size: var(--font-size-4xl);
		font-weight: 700;
		line-height: 1.1;
		color: var(--color-text);
	}

	.hero__text {
		margin: 0 0 2rem;
		color: var(--color-text-muted);
		font-size: var(--font-size-lg);
		line-height: var(--line-height-relaxed);
	}

	.hero__actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.hero__btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.75rem 1.5rem;
		border-radius: var(--border-radius-full);
		font-weight: 600;
		text-decoration: none;
		transition: all var(--transition-fast);
	}

	.hero__btn:hover { text-decoration: none; }

	.hero__btn--primary {
		background: var(--color-primary);
		color: white;
		box-shadow: var(--shadow-primary);
	}

	.hero__btn--primary:hover {
		background: var(--color-primary-dark);
	}

	.hero__btn--secondary {
		background: var(--color-surface);
		color: var(--color-text);
		border: var(--border-width) solid var(--color-border);
	}

	.hero__btn--secondary:hover {
		background: var(--color-bg-muted);
	}

	/* ---- SECTIONS ---- */
	.section {
		padding: 2.5rem 0;
	}

	.section--muted {
		background: var(--color-bg-muted);
	}

	.section--cta {
		text-align: center;
	}

	.container {
		max-width: 64rem;
		margin: 0 auto;
		padding: 0 1.25rem;
	}

	.section__header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 1.25rem;
	}

	.section__title {
		margin: 0 0 1rem;
		font-size: var(--font-size-xl);
		font-weight: 700;
	}

	.section__link {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-primary);
		text-decoration: none;
	}

	.section__link:hover {
		text-decoration: underline;
	}

	/* ---- FEATURED TOURS ---- */
	.featured-tours {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: 1rem;
	}

	.featured-tour-card {
		background: var(--color-surface);
		border-radius: var(--border-radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-card);
		text-decoration: none;
		color: inherit;
		transition: box-shadow var(--transition-normal), transform var(--transition-normal);
	}

	.featured-tour-card:hover {
		box-shadow: var(--shadow-soft);
		transform: translateY(-2px);
		text-decoration: none;
	}

	.featured-tour-card__image-wrap {
		position: relative;
		height: 8rem;
		overflow: hidden;
	}

	.featured-tour-card__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.featured-tour-card__overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 50%);
	}

	.featured-tour-card__date {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		padding: 0.2rem 0.5rem;
		background: var(--color-primary);
		color: white;
		font-size: var(--font-size-xs);
		font-weight: 700;
		border-radius: var(--border-radius-sm);
	}

	.featured-tour-card__body {
		padding: 0.75rem;
	}

	.featured-tour-card__body h3 {
		margin: 0 0 0.25rem;
		font-size: var(--font-size-sm);
		font-weight: 700;
		line-height: var(--line-height-tight);
	}

	.featured-tour-card__location {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.2rem;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	/* ---- REVIEWS ---- */
	.reviews-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: 1rem;
	}

	.review-card {
		background: var(--color-surface);
		padding: 1.25rem;
		border-radius: var(--border-radius-lg);
		box-shadow: var(--shadow-sm);
		overflow: hidden;
	}

	.review-card__photo {
		margin: -1.25rem -1.25rem 0.75rem;
		aspect-ratio: 16 / 10;
		background: var(--color-bg-muted);
	}

	.review-card__photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.review-card__stars {
		display: flex;
		gap: 0.1rem;
		margin-bottom: 0.5rem;
	}

	.review-star {
		font-size: 18px;
		color: var(--color-border);
	}

	.review-star--filled {
		color: #f59e0b;
		font-variation-settings: 'FILL' 1;
	}

	.review-card__comment {
		margin: 0 0 0.5rem;
		font-size: var(--font-size-sm);
		color: var(--color-text);
		font-style: italic;
		line-height: var(--line-height-relaxed);
	}

	.review-card__author {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-weight: 600;
	}

	/* ---- BLOG ---- */
	.blog-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: 1rem;
	}

	.blog-card {
		padding: var(--card-padding);
		border: var(--border-width) solid var(--color-border-light);
		border-radius: var(--border-radius);
		background: var(--color-surface);
	}

	.blog-card h3 {
		margin: 0 0 0.25rem;
		font-size: var(--font-size-base);
	}

	.blog-meta {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin: 0 0 0.5rem;
	}

	.read-more {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-primary);
	}

	/* ---- CTA CARD ---- */
	.cta-card {
		max-width: 32rem;
		padding: 2.5rem 1.5rem;
		text-align: center;
	}

	.cta-card__icon {
		font-size: 48px;
		color: var(--color-primary);
		margin-bottom: 0.75rem;
	}

	.cta-card h2 {
		margin: 0 0 0.5rem;
	}

	.cta-card p {
		color: var(--color-text-muted);
		margin: 0 0 1.5rem;
	}

	.cta-card__btn {
		display: inline-flex;
		padding: 0.75rem 2rem;
		background: var(--color-primary);
		color: white;
		font-weight: 700;
		border-radius: var(--border-radius-full);
		text-decoration: none;
		box-shadow: var(--shadow-primary);
		transition: background var(--transition-fast);
	}

	.cta-card__btn:hover {
		background: var(--color-primary-dark);
		text-decoration: none;
	}

	/* ---- NEWSLETTER ---- */
	.newsletter-section {
		max-width: 28rem;
		text-align: center;
	}

	.newsletter-text {
		margin: 0 0 1rem;
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}

	.newsletter-form {
		display: flex;
		gap: 0.5rem;
		max-width: 24rem;
		margin: 0 auto;
	}

	.newsletter-form label { display: none; }

	.newsletter-form input {
		flex: 1;
		min-width: 10rem;
	}

	.newsletter-message {
		margin: 0.5rem 0 0;
		font-size: var(--font-size-sm);
	}

	.newsletter-message.success {
		color: var(--color-success);
	}

	/* ---- RESPONSIVE ---- */
	@media (min-width: 768px) {
		.hero {
			padding: 5rem 2rem 6rem;
		}

		.hero__title {
			font-size: 3rem;
		}
	}
</style>
