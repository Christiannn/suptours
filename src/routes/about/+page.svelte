<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Om SUP Tours — Vores Mission</title>
	<meta name="description" content="Læs om hvordan SUP Tours startede og vores mission om at skabe et fællesskab for vandelskere." />
</svelte:head>

<div class="container py-8">
	<article class="prose">
		<h1>Om SUP Tours</h1>
		
		<p class="lead">
			Velkommen til SUP Tours. Vi er et fællesskab af passionerede Stand Up Paddlere, 
			der elsker at udforske Danmarks smukke kyster, søer og åer.
		</p>

		<section>
			<h2>Vores Mission</h2>
			<p>
				Vores mission er at gøre det nemt for alle at komme ud på vandet. Vi mener, 
				at Stand Up Paddling er den bedste måde at forbinde med naturen på, få frisk luft 
				og møde nye mennesker. SUP Tours blev skabt for at fjerne barriererne for at 
				finde og organisere ture.
			</p>
		</section>

		<section>
			<h2>Uafhængig og Fællesskabsdrevet</h2>
			<p>
				Som du måske har læst, er vi stolte af at være "Not US Big Tech". Det betyder, 
				at vi ikke er drevet af algoritmer eller annonceindtægter. Vi er bygget af paddlere, 
				for paddlere. Dit data er dit eget, og vores fokus er udelukkende på at skabe 
				gode oplevelser på vandet.
			</p>
		</section>

		<section>
			<h2>Kontakt Os</h2>
			<p>
				Har du spørgsmål, forslag eller vil du bare sige hej? Du kan finde os i vores 
				<a href={resolve('/community')}>Community</a> sektion, eller række ud til os 
				direkte via vores sociale medier.
			</p>
		</section>
		
		<div class="mt-8">
			<a href={resolve('/')} class="btn-primary">Tilbage til forsiden</a>
		</div>
	</article>
</div>

<style>
	.container {
		max-width: 48rem;
		margin: 0 auto;
		padding: 2rem 1.25rem;
	}
	
	.prose {
		line-height: 1.6;
		color: var(--color-text);
	}
	
	.prose h1 {
		font-size: var(--font-size-3xl);
		margin-bottom: 1.5rem;
		color: var(--color-primary-dark);
	}
	
	.prose h2 {
		font-size: var(--font-size-xl);
		margin-top: 2rem;
		margin-bottom: 1rem;
	}
	
	.prose p {
		margin-bottom: 1.25rem;
	}
	
	.lead {
		font-size: var(--font-size-lg);
		font-weight: 500;
	}

	.btn-primary {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		background: var(--color-primary);
		color: white;
		border-radius: var(--border-radius-full);
		text-decoration: none;
		font-weight: 600;
	}
	
	.btn-primary:hover {
		background: var(--color-primary-dark);
		text-decoration: none;
	}

	.mt-8 { margin-top: 2rem; }
</style>
