/**
 * Groups tours by date proximity into human-readable labels.
 * "Today", "Tomorrow", "This Weekend", "Next Week", month names, etc.
 */

export interface Tour {
	id: string;
	title: string;
	description: string | null;
	image_url: string | null;
	start_date: string;
	start_time: string | null;
	end_date: string | null;
	locality: string | null;
	latitude: number | null;
	longitude: number | null;
	tags: string[];
	source: 'user' | 'web';
	status: string;
	max_participants: number | null;
	creator_id: string;
	responsible_person: string | null;
	contact_info: string | null;
	security_notes: string | null;
	parking_info: string | null;
	age_min: number | null;
	age_max: number | null;
	featured: boolean;
	view_count: number;
	external_url: string | null;
	created_at: string | null;
	participant_count: number;
	has_joined: boolean;
	creator_name?: string | null;
	creator_avatar?: string | null;
}

export interface TourGroup {
	label: string;
	tours: Tour[];
}

function getStartOfDay(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

function isSameDay(a: Date, b: Date): boolean {
	return a.getFullYear() === b.getFullYear()
		&& a.getMonth() === b.getMonth()
		&& a.getDate() === b.getDate();
}

function isWeekend(d: Date): boolean {
	return d.getDay() === 0 || d.getDay() === 6;
}

function getNextSaturday(from: Date): Date {
	const d = new Date(from);
	const day = d.getDay();
	const daysUntilSat = (6 - day + 7) % 7 || 7;
	d.setDate(d.getDate() + daysUntilSat);
	d.setHours(0, 0, 0, 0);
	return d;
}

function getNextSunday(from: Date): Date {
	const sat = getNextSaturday(from);
	sat.setDate(sat.getDate() + 1);
	return sat;
}

export function groupToursByDate(tours: Tour[]): TourGroup[] {
	const now = new Date();
	const today = getStartOfDay(now);
	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);

	const dayOfWeek = today.getDay(); // 0=Sun
	// "This weekend" = next Sat+Sun unless today is already weekend
	const thisSat = getNextSaturday(today);
	const thisSun = new Date(thisSat);
	thisSun.setDate(thisSun.getDate() + 1);

	// Next Monday
	const nextMonday = new Date(thisSun);
	nextMonday.setDate(nextMonday.getDate() + 1);
	const nextSunday = new Date(nextMonday);
	nextSunday.setDate(nextSunday.getDate() + 6);

	const groups = new Map<string, Tour[]>();

	for (const tour of tours) {
		const tourDate = getStartOfDay(new Date(tour.start_date + 'T00:00:00'));
		let label: string;

		if (isSameDay(tourDate, today)) {
			label = 'Today';
		} else if (isSameDay(tourDate, tomorrow)) {
			label = 'Tomorrow';
		} else if (
			// This weekend: Sat or Sun of the current week
			(isSameDay(tourDate, thisSat) || isSameDay(tourDate, thisSun)) &&
			!isSameDay(thisSat, today) && !isSameDay(thisSun, today)
		) {
			label = 'This Weekend';
		} else if (tourDate >= nextMonday && tourDate <= nextSunday) {
			label = 'Next Week';
		} else {
			// Month label: "March 2026"
			label = tourDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
		}

		if (!groups.has(label)) {
			groups.set(label, []);
		}
		groups.get(label)!.push(tour);
	}

	// Convert to array preserving insertion order (already chronological since tours are sorted)
	return Array.from(groups.entries()).map(([label, tours]) => ({ label, tours }));
}
