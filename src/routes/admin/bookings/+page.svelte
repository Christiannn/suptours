<script lang="ts">
	import { onMount } from 'svelte';
	import {
		DEFAULT_BOOKING_CONFIG,
		type BookingBookable,
		type BookingConfig,
		type Weekday
	} from '$lib/booking/config';
	import { loadBookingConfig, saveBookingConfig } from '$lib/booking/storage';

	const weekdays: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
	const weekdayLabels: Record<Weekday, string> = {
		monday: 'Monday',
		tuesday: 'Tuesday',
		wednesday: 'Wednesday',
		thursday: 'Thursday',
		friday: 'Friday'
	};

	let config = $state<BookingConfig>(DEFAULT_BOOKING_CONFIG);
	let toast = $state('');
	let form = $state({
		name: '',
		seats: 1,
		monday: '',
		tuesday: '',
		wednesday: '',
		thursday: '',
		friday: ''
	});

	onMount(() => {
		config = loadBookingConfig();
	});

	function save() {
		saveBookingConfig(config);
		showToast('Booking setup saved.');
	}

	function resetDefaults() {
		config = DEFAULT_BOOKING_CONFIG;
		save();
	}

	function createBookable() {
		if (!form.name.trim()) {
			showToast('Name is required.');
			return;
		}

		const id = `${form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
		const next: BookingBookable = {
			id,
			name: form.name.trim(),
			seats: Math.max(1, Number(form.seats) || 1),
			schedule: {
				monday: parseSlots(form.monday),
				tuesday: parseSlots(form.tuesday),
				wednesday: parseSlots(form.wednesday),
				thursday: parseSlots(form.thursday),
				friday: parseSlots(form.friday)
			}
		};

		config = {
			bookables: [...config.bookables, next]
		};

		form = {
			name: '',
			seats: 1,
			monday: '',
			tuesday: '',
			wednesday: '',
			thursday: '',
			friday: ''
		};

		save();
	}

	function removeBookable(id: string) {
		config = {
			bookables: config.bookables.filter((item) => item.id !== id)
		};
		save();
	}

	function parseSlots(raw: string): string[] {
		return raw
			.split(',')
			.map((value) => value.trim())
			.filter(Boolean);
	}

	function showToast(message: string) {
		toast = message;
		setTimeout(() => {
			toast = '';
		}, 2400);
	}
</script>

<section class="admin-bookings">
	<h1>Admin bookings</h1>
	<p>Define what can be booked, seat count, and weekly timeslots.</p>

	<div class="toolbar">
		<button type="button" onclick={save}>Save setup</button>
		<button type="button" onclick={resetDefaults}>Reset defaults</button>
	</div>

	<div class="bookable-list">
		<h2>Bookables</h2>
		{#if config.bookables.length === 0}
			<p>No bookables yet.</p>
		{:else}
			{#each config.bookables as item (item.id)}
				<article class="bookable-card">
					<header>
						<strong>{item.name}</strong>
						<span>{item.seats} seats</span>
					</header>
					<ul>
						{#each weekdays as day (day)}
							<li><strong>{weekdayLabels[day]}:</strong> {item.schedule[day].join(', ') || '-'}</li>
						{/each}
					</ul>
					<button type="button" class="danger" onclick={() => removeBookable(item.id)}>Delete</button>
				</article>
			{/each}
		{/if}
	</div>

	<div class="create-form">
		<h2>Bookables: Create new</h2>
		<div class="form-grid">
			<label>
				Name
				<input bind:value={form.name} placeholder="Hairdresser 1 Lucy" />
			</label>
			<label>
				Seats
				<input type="number" min="1" bind:value={form.seats} />
			</label>
			{#each weekdays as day (day)}
				<label>
					{weekdayLabels[day]} timeslots
					<input
						bind:value={form[day]}
						placeholder="08:00, 09:00, 10:00"
					/>
				</label>
			{/each}
		</div>
		<button type="button" onclick={createBookable}>Create new</button>
	</div>

	{#if toast}
		<div class="toast" role="status" aria-live="polite">{toast}</div>
	{/if}
</section>

<style>
	.admin-bookings {
		display: grid;
		gap: 1rem;
		max-width: 72rem;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.bookable-list {
		display: grid;
		gap: 0.75rem;
	}

	.bookable-card {
		padding: var(--card-padding);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
	}

	.bookable-card header {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.bookable-card ul {
		margin: 0 0 0.75rem;
		padding-left: 1rem;
	}

	.create-form {
		padding: var(--card-padding);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
	}

	.form-grid {
		display: grid;
		gap: 0.5rem;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		margin-bottom: 0.75rem;
	}

	label {
		display: grid;
		gap: 0.25rem;
	}

	.danger {
		background: transparent;
		border-color: #b3261e;
		color: #b3261e;
	}

	.toast {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		padding: 0.75rem 1rem;
		background: var(--color-accent);
		color: white;
		border-radius: var(--border-radius-sm);
		box-shadow: 0 4px 14px rgb(0 0 0 / 20%);
	}
</style>
