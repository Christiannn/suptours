<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Betingelser — SUP Tours</title>
	<meta name="description" content="Læs vores betingelser og vilkår for brug af SUP Tours platformen." />
</svelte:head>

<div class="container py-8">
	<article class="prose">
		<h1>Betingelser og Vilkår</h1>
		
		<p class="last-updated">Sidst opdateret: 28. april 2026</p>

		<section>
			<h2>1. Accept af vilkår</h2>
			<p>
				Ved at tilgå og bruge SUP Tours platformen, accepterer du at være bundet af disse 
				betingelser og vilkår. Hvis du ikke kan acceptere disse vilkår, bedes du ikke 
				benytte siden.
			</p>
		</section>

		<section>
			<h2>2. Brugeradfærd</h2>
			<p>
				SUP Tours er et fællesskab baseret på tillid og respekt. Vi forventer at alle 
				brugere udviser god stil, både online og når vi mødes på vandet. Chikane, 
				upassende sprogbrug eller vildledende information tolereres ikke.
			</p>
		</section>

		<section>
			<h2>3. Ansvar på vandet</h2>
			<p>
				Deltagelse i ture organiseret via SUP Tours sker på eget ansvar. Vi opfordrer 
				kraftigt alle til at vurdere egne evner, tjekke vejrforhold og altid bære 
				lovpligtigt redningsudstyr (svømmevest eller redningsvest). SUP Tours er en 
				platform for formidling af kontakt og er ikke ansvarlig for ulykker eller 
				skader opstået under ture.
			</p>
		</section>

		<section>
			<h2>4. Datasikkerhed</h2>
			<p>
				Vi passer på dine data. Som en uafhængig platform sælger vi ikke dine 
				personlige oplysninger til tredjeparter. Vi bruger kun de data, der er 
				nødvendige for at drive platformen og give dig en god oplevelse.
			</p>
		</section>

		<section>
			<h2>5. Ændringer</h2>
			<p>
				Vi forbeholder os retten til at opdatere disse vilkår løbende. Ved væsentlige 
				ændringer vil vi informere vores brugere via email eller på platformen.
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
		margin-bottom: 0.5rem;
		color: var(--color-primary-dark);
	}
	
	.last-updated {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin-bottom: 2rem;
	}
	
	.prose h2 {
		font-size: var(--font-size-xl);
		margin-top: 2rem;
		margin-bottom: 1rem;
	}
	
	.prose p {
		margin-bottom: 1.25rem;
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
