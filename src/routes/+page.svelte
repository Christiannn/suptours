<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import GallarySlider from '$lib/Shared/GallarySlider.svelte';
	import { getTourShowSlug } from '$lib/tours/tourSlug';

	let { data, form } = $props();
</script>

<!-- Hero Section -->
<section class="hero">
	<div class="hero__bg" aria-hidden="true">
		<div class="hero__bg-base"></div>
		<div class="hero__waves">
			<svg
				class="hero__waves-svg"
				viewBox="0 0 1200 420"
				preserveAspectRatio="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<g
					class="hero__wave-layer hero__wave-layer--a"
					fill="none"
					stroke="currentColor"
					stroke-width="0.55"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M-240 98 C80 78 320 118 560 98 S920 78 1160 98 S1400 118 1480 98"
					/>
					<path
						d="M-200 138 C120 158 360 118 600 138 S960 158 1200 138 S1440 118 1520 138"
					/>
					<path
						d="M-260 178 C60 158 340 198 580 178 S900 158 1140 178 S1380 198 1460 178"
					/>
					<path
						d="M-220 218 C140 238 380 198 620 218 S980 238 1220 218 S1460 198 1540 218"
					/>
					<path
						d="M-280 258 C100 238 380 278 620 258 S940 238 1180 258 S1420 278 1500 258"
					/>
				</g>
				<g
					class="hero__wave-layer hero__wave-layer--b"
					fill="none"
					stroke="currentColor"
					stroke-width="0.4"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M-300 118 C160 98 400 138 640 118 S1000 98 1240 118 S1480 138 1560 118"
					/>
					<path
						d="M-180 198 C200 218 440 178 680 198 S1040 218 1280 198 S1520 178 1600 198"
					/>
					<path
						d="M-320 278 C80 258 360 298 600 278 S920 258 1160 278 S1400 298 1480 278"
					/>
				</g>
			</svg>
		</div>
	</div>
	<div class="hero__content">
		<span class="hero__badge">Denmark & Beyond</span>
		<h1 class="hero__title">Find Your Next<br/>SUP Adventure</h1>
		<p class="hero__text">
			Plan, discover, and join stand up paddle tours with an amazing community of water lovers in Denmark, and beyond!
		</p>
		<div class="hero__actions">
			<a href={resolve('/tours')} class="hero__btn hero__btn--primary">
				<span class="material-symbols-outlined">explore</span>
				Browse Tours
			</a>
			{#if !data.user}
				<a href={resolve('/signup')} class="hero__btn hero__btn--secondary hero__btn--sunset">
					Join the community
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
						href={`${resolve('/tours')}?show=${encodeURIComponent(getTourShowSlug(tour))}`}
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

<!-- Value: independent of US Big Tech -->
<section class="section home-trust" aria-labelledby="home-trust-heading">
	<div class="container">
		<div class="home-trust__card" class:home-trust__card--has-media={Boolean(data.homeTrustImageUrl)}>
			{#if data.homeTrustImageUrl}
				<div class="home-trust__media">
					<img
						src={data.homeTrustImageUrl}
						alt=""
						loading="lazy"
						decoding="async"
					/>
				</div>
			{/if}
			<div class="home-trust__content">
				<p class="home-trust__label">Not US Big Tech</p>
				<h2 id="home-trust-heading" class="home-trust__title">Built for paddlers, not ad markets</h2>
				<p class="home-trust__text">
					SUP Tours is independent, community-led software for finding water time in Denmark and Europe—without
					the surveillance-ad playbook or Silicon Valley growth-at-all-costs. Fewer middlemen, clearer intent:
					trips, people, and shorelines you care about stay the point of the product.
				</p>
			</div>
		</div>
	</div>
</section>

<!-- Recent Reviews -->
{#if data.recentReviews.length > 0}
	<section class="section section--muted">
		<div class="container">
			<h2 class="section__title">What Paddlers Say</h2>
			<div class="reviews-grid">
				{#each data.recentReviews as review (review.id)}
					<div class="review-card">
						<div class="review-card__stars">
							{#each Array(5) as _, i}
								<span class="material-symbols-outlined review-star" class:review-star--filled={i < review.rating}>
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

<!-- Pre-footer: CTA + Newsletter -->
<section class="pre-footer">
	<div class="container pre-footer__grid">
		<div class="pre-footer__card cta-card">
			<svg
				class="cta-card__sup-icon"
				viewBox="0 0 120 120"
				role="img"
				aria-label="Stand up paddle icon"
			>
				<rect x="42" y="8" width="36" height="104" rx="17" ry="17" />
				<ellipse cx="60" cy="66" rx="10" ry="22" class="cta-card__sup-icon-cutout" />
				<path d="M52 30 L68 36 M68 30 L52 36" class="cta-card__sup-icon-stroke" />
				<line x1="18" y1="84" x2="96" y2="46" class="cta-card__sup-icon-stroke" />
				<ellipse cx="14" cy="86" rx="11" ry="5" transform="rotate(-20 14 86)" />
				<circle cx="100" cy="44" r="3.1" />
			</svg>
			<h2>Got a Favorite Spot?</h2>
			<p>Create your own SUP tour and invite the community to join you on the water!</p>
			<a href={resolve(data.user ? '/tours/new' : '/signup')} class="cta-card__btn">
				{data.user ? 'Create a Tour' : 'Sign Up & Create'}
			</a>
		</div>

		<div class="pre-footer__card newsletter-section">
			<span class="material-symbols-outlined newsletter-section__icon">mark_email_unread</span>
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
		z-index: 0;
		pointer-events: none;
	}

	.hero__bg-base {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(
				160deg,
				rgba(var(--color-primary-rgb), 0.14) 0%,
				rgba(245, 239, 230, 0.3) 40%,
				rgba(var(--color-primary-rgb), 0.07) 100%
			),
			radial-gradient(circle at 20% 30%, rgba(var(--color-primary-rgb), 0.22), transparent 60%),
			radial-gradient(circle at 80% 70%, rgba(var(--color-primary-rgb), 0.12), transparent 65%);
	}

	.hero__waves {
		position: absolute;
		inset: -8% -4%;
		height: 116%;
		color: color-mix(in srgb, var(--color-primary-dark) 72%, var(--color-text) 28%);
		opacity: 0.26;
		mix-blend-mode: multiply;
	}

	.hero__waves-svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.hero__wave-layer {
		animation: hero-wave-drift 28s ease-in-out infinite alternate;
	}

	.hero__wave-layer--b {
		animation-duration: 38s;
		animation-direction: alternate-reverse;
		opacity: 0.72;
	}

	@keyframes hero-wave-drift {
		0% {
			transform: translate3d(-1.8%, 0.2%, 0);
		}
		50% {
			transform: translate3d(0.6%, -0.35%, 0);
		}
		100% {
			transform: translate3d(1.8%, 0, 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero__wave-layer {
			animation: none;
		}
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
		background: #fff3eb;
		color: #9a3412;
		border: 1px solid #ea580c;
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
		border: 1px solid var(--color-primary-border);
		background: var(--color-primary);
		color: white;
		box-shadow: var(--shadow-primary);
	}

	.hero__btn--primary:hover {
		background: var(--color-primary-dark);
		border-color: var(--color-primary-border);
	}

	.hero__btn--secondary {
		background: var(--color-surface);
		color: var(--color-text);
		border: var(--border-width) solid var(--color-border);
	}

	.hero__btn--secondary:hover {
		background: var(--color-bg-muted);
	}

	.hero__btn--secondary.hero__btn--sunset {
		border: none;
		background: linear-gradient(
			118deg,
			#ea580c 0%,
			#f97316 18%,
			#fbbf24 42%,
			#fde047 58%,
			#38bdf8 88%,
			#0ea5e9 100%
		);
		background-size: 120% 100%;
		color: var(--color-text-light);
		text-shadow: 0 1px 2px rgba(15, 23, 42, 0.35);
		box-shadow:
			0 2px 14px rgba(234, 88, 12, 0.35),
			0 1px 0 rgba(255, 255, 255, 0.2) inset;
	}

	.hero__btn--secondary.hero__btn--sunset:hover {
		background: linear-gradient(
			118deg,
			#c2410c 0%,
			#ea580c 18%,
			#f59e0b 42%,
			#facc15 58%,
			#0ea5e9 88%,
			#0284c7 100%
		);
		background-size: 120% 100%;
		filter: brightness(1.03);
	}

	/* ---- SECTIONS ---- */
	.section {
		padding: 2.5rem 0;
	}

	.section--muted {
		background: var(--color-bg-muted);
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
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1rem;
		align-items: stretch;
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

	/* ---- TRUST / NOT BIG TECH (orange badge + optional admin image) ---- */
	.home-trust {
		padding: 2rem 0 2.25rem;
		background: linear-gradient(
			155deg,
			#fff7ed 0%,
			#ffedd5 38%,
			rgba(var(--color-primary-rgb), 0.09) 100%
		);
		border-top: 1px solid rgba(234, 88, 12, 0.12);
		border-bottom: 1px solid rgba(234, 88, 12, 0.1);
	}

	.home-trust__card {
		display: grid;
		gap: 1.35rem;
		align-items: center;
		max-width: 56rem;
		margin: 0 auto;
	}

	.home-trust__card--has-media .home-trust__content {
		text-align: left;
	}

	@media (min-width: 768px) {
		.home-trust__card--has-media {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
			gap: 1.75rem;
		}
	}

	.home-trust__media {
		width: 100%;
		max-width: 22rem;
		justify-self: center;
		border-radius: var(--border-radius);
		overflow: hidden;
		box-shadow: var(--shadow-card);
		border: 1px solid rgba(234, 88, 12, 0.45);
		background: var(--color-secondary);
	}

	.home-trust__media img {
		display: block;
		width: 100%;
		height: auto;
		min-height: 8rem;
		max-height: 11rem;
		object-fit: cover;
	}

	.home-trust__content {
		text-align: center;
		max-width: 38rem;
		margin: 0 auto;
	}

	.home-trust__card--has-media .home-trust__content {
		margin: 0;
		max-width: none;
	}

	.home-trust__label {
		display: inline-block;
		margin: 0 0 0.75rem;
		padding: 0.25rem 0.75rem;
		background: #fff3eb;
		color: #9a3412;
		border: 1px solid #ea580c;
		font-size: var(--font-size-xs);
		font-weight: 700;
		border-radius: var(--border-radius-full);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.home-trust__title {
		margin: 0 0 0.75rem;
		font-size: var(--font-size-lg);
		font-weight: 700;
		line-height: var(--line-height-tight);
		color: var(--color-text);
	}

	.home-trust__text {
		margin: 0;
		font-size: var(--font-size-sm);
		line-height: var(--line-height-relaxed);
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
	.pre-footer {
		background: #e6e7eb;
		padding: 2.25rem 0;
		border-top: 1px solid #d5d7dd;
	}

	.pre-footer__grid {
		display: flex;
		gap: 1.25rem;
		align-items: stretch;
		justify-content: space-between;
	}

	.pre-footer__card {
		flex: 1 1 0;
		padding: 1.5rem 1.25rem;
		color: var(--color-text);
	}

	.pre-footer__card + .pre-footer__card {
		border-left: 1px solid #cfd3da;
	}

	.cta-card {
		text-align: center;
	}

	.pre-footer .section__title {
		margin: 0 0 0.65rem;
		font-size: clamp(1.28rem, 2.4vw, 1.48rem);
		line-height: 1.2;
	}

	.pre-footer .cta-card p,
	.pre-footer .newsletter-text {
		margin: 0 0 1rem;
		font-size: var(--font-size-base);
		line-height: 1.55;
	}

	.cta-card__sup-icon {
		width: 64px;
		height: 64px;
		display: block;
		margin: 0 auto 0.8rem;
		color: var(--color-primary);
		fill: currentColor;
	}

	.cta-card__sup-icon-cutout {
		fill: var(--color-surface);
	}

	.cta-card__sup-icon-stroke {
		fill: none;
		stroke: var(--color-surface);
		stroke-width: 2.3;
		stroke-linecap: round;
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
		border: 1px solid var(--color-primary-border);
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
		border-color: var(--color-primary-border);
		text-decoration: none;
	}

	/* ---- NEWSLETTER ---- */
	.newsletter-section {
		text-align: center;
	}

	.newsletter-section__icon {
		display: block;
		font-size: 3.9rem;
		line-height: 1;
		margin: 0 auto 0.75rem;
		color: #c2410c;
	}

	.pre-footer .newsletter-section .section__title {
		color: #9a3412;
	}

	.newsletter-text {
		margin: 0 0 1rem;
		color: var(--color-text-muted);
		font-size: var(--font-size-base);
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

	.pre-footer .newsletter-form .primary {
		background: #fff3eb;
		border: 1px solid #ea580c;
		border-radius: var(--border-radius-sm);
		color: #9a3412;
		font-weight: 700;
	}

	.pre-footer .newsletter-form .primary:hover {
		background: #ffedd5;
		border-color: #c2410c;
		color: #7c2d12;
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

		.home-trust__media {
			max-width: 20rem;
		}
	}

	@media (max-width: 767px) {
		.home-trust__media {
			max-width: none;
		}

		.home-trust__media img {
			min-height: 6.25rem;
			max-height: 8.5rem;
		}
	}

	@media (max-width: 900px) {
		.featured-tours {
			display: grid;
			grid-auto-flow: column;
			grid-auto-columns: minmax(15.5rem, 1fr);
			grid-template-columns: none;
			overflow-x: auto;
			padding-bottom: 0.25rem;
			scrollbar-width: thin;
		}
	}

	@media (max-width: 767px) {
		.pre-footer__grid {
			flex-direction: column;
		}

		.pre-footer__card + .pre-footer__card {
			border-left: 0;
			border-top: 1px solid #cfd3da;
		}
	}
</style>
