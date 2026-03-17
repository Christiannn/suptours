import { browser } from '$app/environment';
import { BOOKING_CONFIG_KEY, DEFAULT_BOOKING_CONFIG, type BookingConfig } from './config';

export function loadBookingConfig(): BookingConfig {
	if (!browser) return DEFAULT_BOOKING_CONFIG;

	const raw = localStorage.getItem(BOOKING_CONFIG_KEY);
	if (!raw) return DEFAULT_BOOKING_CONFIG;

	try {
		const parsed = JSON.parse(raw) as BookingConfig;
		if (!parsed?.bookables || !Array.isArray(parsed.bookables)) {
			return DEFAULT_BOOKING_CONFIG;
		}
		return parsed;
	} catch {
		return DEFAULT_BOOKING_CONFIG;
	}
}

export function saveBookingConfig(config: BookingConfig) {
	if (!browser) return;
	localStorage.setItem(BOOKING_CONFIG_KEY, JSON.stringify(config));
}
