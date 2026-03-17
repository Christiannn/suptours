<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { loadBookingConfig } from '$lib/booking/storage';
	import type { BookingBookable, Weekday } from '$lib/booking/config';
	import type { PageData } from './$types';

	type DayHeader = {
		day: Weekday;
		label: string;
		isoDate: string;
	};

	const weekdays: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
	const dayLabel: Record<Weekday, string> = {
		monday: 'Mon',
		tuesday: 'Tue',
		wednesday: 'Wed',
		thursday: 'Thu',
		friday: 'Fri'
	};

	let { data, form }: { data: PageData; form: { message?: string; success?: boolean } | null } = $props();

	let bookables = $state<BookingBookable[]>([]);
	let selectedBookableId = $state('');
	let toast = $state('');

	const selectedBookable = $derived(
		bookables.find((item) => item.id === selectedBookableId) ?? bookables[0] ?? null
	);

	const weekHeaders = $derived(getWeekHeaders());
	const timeslots = $derived(getTimeSlotsForBookable(selectedBookable));

	onMount(() => {
		const config = loadBookingConfig();
		bookables = config.bookables;
		selectedBookableId = config.bookables[0]?.id ?? '';
	});

	const seatBookings = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const booking of data.bookings) {
			const key = `${booking.bookable_id}|${booking.booking_date}|${booking.timeslot}`;
			counts[key] = (counts[key] ?? 0) + 1;
		}
		return counts;
	});

	function getWeekHeaders(): DayHeader[] {
		const now = new Date();
		const day = now.getDay();
		const diffToMonday = day === 0 ? -6 : 1 - day;
		const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);

		return weekdays.map((weekday, index) => {
			const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1000);
			const isoDate = toIsoDate(date);
			const shortDate = date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
			return { day: weekday, label: `${dayLabel[weekday]} ${shortDate}`, isoDate };
		});
	}

	function getTimeSlotsForBookable(bookable: BookingBookable | null): string[] {
		if (!bookable) return [];
		const allSlots = weekdays.flatMap((weekday) => bookable.schedule[weekday] ?? []);
		return [...new Set(allSlots)].sort();
	}

	function toIsoDate(date: Date) {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	function getAvailability(isoDate: string, timeslot: string) {
		if (!selectedBookable) return 0;
		const key = `${selectedBookable.id}|${isoDate}|${timeslot}`;
		const bookedCount = seatBookings[key] ?? 0;
		return Math.max(0, selectedBookable.seats - bookedCount);
	}

	function showToast(message: string) {
		toast = message;
		setTimeout(() => {
			toast = '';
		}, 2400);
	}
</script>

<section class="booking-page">
	{#if bookables.length === 0}
		<p>No bookables configured yet. Ask admin to set up `/admin/bookings`.</p>
	{:else}
		<div class="toolbar">
			<label for="bookable-select">Bookable</label>
			<select
				id="bookable-select"
				bind:value={selectedBookableId}
			>
				{#each bookables as bookable (bookable.id)}
					<option value={bookable.id}>{bookable.name} ({bookable.seats} seats)</option>
				{/each}
			</select>
		</div>

		<div class="calendar-wrap">
			<table class="booking-calendar">
				<thead>
					<tr>
						<th scope="col">Time</th>
						{#each weekHeaders as header (header.isoDate)}
							<th scope="col">{header.label}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each timeslots as timeslot (timeslot)}
						<tr>
							<th scope="row">{timeslot}</th>
							{#each weekHeaders as header (header.isoDate)}
								<td>
									{#if selectedBookable?.schedule[header.day]?.includes(timeslot)}
										{@const available = getAvailability(header.isoDate, timeslot)}
										<form
											method="POST"
											action="?/book"
											use:enhance={() => {
												return async ({ result, update }) => {
													await update();
													await invalidateAll();
													if (result.type === 'success') {
														showToast('Booking confirmed.');
													} else if (result.type === 'failure') {
														showToast((result.data as any)?.message ?? 'Could not book slot.');
													}
												};
											}}
											class="slot-card"
										>
											<div>Seats left: {available}</div>
											<input type="hidden" name="bookable_id" value={selectedBookable.id} />
											<input type="hidden" name="bookable_name" value={selectedBookable.name} />
											<input type="hidden" name="booking_date" value={header.isoDate} />
											<input type="hidden" name="timeslot" value={timeslot} />
											<input type="hidden" name="seats" value={String(selectedBookable.seats)} />
											<button
												type="submit"
												disabled={available <= 0}
												onclick={(event) => {
													const confirmed = confirm(
														`Book ${selectedBookable.name} on ${header.isoDate} at ${timeslot}?`
													);
													if (!confirmed) event.preventDefault();
												}}
											>
												Book
											</button>
										</form>
									{:else}
										<span class="off">-</span>
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if form?.message}
		<p class="sr-message">{form.message}</p>
	{/if}

	{#if toast}
		<div class="toast" role="status" aria-live="polite">{toast}</div>
	{/if}
</section>

<style>
	.booking-page {
		display: grid;
		gap: 1rem;
	}

	.toolbar {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.calendar-wrap {
		overflow-x: auto;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--border-radius);
	}

	.booking-calendar {
		width: 100%;
		min-width: 52rem;
		border-collapse: collapse;
	}

	th,
	td {
		border: var(--border-width) solid var(--color-border);
		padding: 0.5rem;
		text-align: left;
		vertical-align: top;
	}

	.slot-card {
		display: grid;
		gap: 0.35rem;
	}

	.off {
		color: var(--color-text-muted);
	}

	.sr-message {
		position: absolute;
		left: -9999px;
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
