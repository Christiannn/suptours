<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
</script>

<div class="auth-page">
	<h1>Sign up</h1>

	<form
		method="POST"
		action="?/signup"
		use:enhance={() => {
			return async ({ result }) => {
				if (result.type === 'redirect') {
					window.location.href = result.location;
				}
			};
		}}
		class="auth-form"
	>
		{#if data?.next}
			<input type="hidden" name="next" value={data.next} />
		{/if}

		<label for="email">Email</label>
		<input id="email" name="email" type="email" required autocomplete="email" />

		<label for="password">Password</label>
		<input id="password" name="password" type="password" required autocomplete="new-password" minlength="6" />

		{#if form?.message}
			<p class="message error">{form.message}</p>
		{/if}

		<button type="submit" class="primary">Sign up</button>
	</form>

	<p class="auth-link">
		Already have an account? <a href={resolve('/login')}>Log in</a>
	</p>
</div>

<style>
	.auth-page {
		max-width: 24rem;
		margin: 0 auto;
		padding: var(--section-padding);
	}

	.auth-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.auth-form label {
		display: block;
		font-weight: 500;
	}

	.auth-form input {
		width: 100%;
	}

	.message.error {
		color: var(--color-error);
		margin: 0;
	}

	.auth-link {
		margin: 0;
		font-size: var(--font-size-sm);
	}
</style>
