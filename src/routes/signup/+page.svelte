<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
</script>

<div class="auth-page">
	<div class="auth-card">
		<h1 class="auth-title">Join SUP Tours</h1>
		<p class="auth-subtitle">Create an account to discover and join paddle adventures</p>

		{#if form?.confirmEmail}
			<div class="confirm-email">
				<span class="material-symbols-outlined">mark_email_read</span>
				<h2>Check your email!</h2>
				<p>We've sent a confirmation link to your email address. Click it to activate your account.</p>
			</div>
		{:else}
			<!-- OAuth buttons -->
			<div class="oauth-buttons">
				<form method="POST" action="?/google" use:enhance>
					<button type="submit" class="oauth-btn">
						<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
							<path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
							<path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
							<path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
							<path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
						</svg>
						Continue with Google
					</button>
				</form>

				<form method="POST" action="?/facebook" use:enhance>
					<button type="submit" class="oauth-btn">
						<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
							<path d="M18 9a9 9 0 10-10.406 8.89v-6.288H5.309V9h2.285V7.017c0-2.255 1.343-3.501 3.4-3.501.984 0 2.014.176 2.014.176v2.215h-1.135c-1.118 0-1.467.694-1.467 1.406V9h2.496l-.399 2.602h-2.097v6.288A9.003 9.003 0 0018 9z" fill="#1877F2"/>
						</svg>
						Continue with Facebook
					</button>
				</form>
			</div>

			<div class="auth-divider">
				<span>or</span>
			</div>

			<!-- Email/password form -->
			<form
				method="POST"
				action="?/signup"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'redirect') {
							window.location.href = result.location;
						} else {
							update();
						}
					};
				}}
				class="auth-form"
			>
				{#if data?.next}
					<input type="hidden" name="next" value={data.next} />
				{/if}

				<label for="email">Email</label>
				<input id="email" name="email" type="email" required autocomplete="email" placeholder="your@email.com" />

				<label for="password">Password</label>
				<input id="password" name="password" type="password" required autocomplete="new-password" minlength="6" placeholder="Min. 6 characters" />

				{#if form?.message}
					<p class="message error">{form.message}</p>
				{/if}

				<button type="submit" class="primary">Create account</button>
			</form>

			<p class="auth-link">
				Already have an account? <a href={resolve('/login')}>Log in</a>
			</p>
		{/if}
	</div>
</div>

<style>
	.auth-page {
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding: 2rem 1rem;
		min-height: 60vh;
	}

	.auth-card {
		width: 100%;
		max-width: 24rem;
		background: var(--color-surface);
		border-radius: var(--border-radius-lg);
		padding: 2rem;
		box-shadow: var(--shadow-card);
	}

	.auth-title {
		margin: 0;
		font-size: var(--font-size-2xl);
		font-weight: 700;
		text-align: center;
	}

	.auth-subtitle {
		margin: 0.25rem 0 1.5rem;
		text-align: center;
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}

	/* Confirm email state */
	.confirm-email {
		text-align: center;
		padding: 1.5rem 0;
	}

	.confirm-email .material-symbols-outlined {
		font-size: 48px;
		color: var(--color-success);
		margin-bottom: 0.75rem;
	}

	.confirm-email h2 {
		margin: 0 0 0.5rem;
		font-size: var(--font-size-xl);
	}

	.confirm-email p {
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}

	/* OAuth */
	.oauth-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.oauth-buttons form { margin: 0; }

	.oauth-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.65rem;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
		background: var(--color-surface);
		font: inherit;
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.oauth-btn:hover {
		background: var(--color-bg-muted);
	}

	/* Divider */
	.auth-divider {
		display: flex;
		align-items: center;
		margin: 1.25rem 0;
	}

	.auth-divider::before,
	.auth-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--color-border);
	}

	.auth-divider span {
		padding: 0 0.75rem;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	/* Form */
	.auth-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.auth-form label {
		display: block;
		font-weight: 500;
		font-size: var(--font-size-sm);
	}

	.auth-form input {
		width: 100%;
	}

	.message.error {
		color: var(--color-error);
		margin: 0;
		font-size: var(--font-size-sm);
	}

	.auth-link {
		margin: 0;
		font-size: var(--font-size-sm);
		text-align: center;
	}
</style>
