/** URL `show` param for agenda: `slugified-title-YYYY-MM-DD` */

export function slugifyTourTitle(text: string) {
	return text
		.toLowerCase()
		.replace(/[^\w ]+/g, '')
		.replace(/ +/g, '-');
}

export function getTourShowSlug(tour: { title: string; start_date: string }) {
	return `${slugifyTourTitle(tour.title)}-${tour.start_date}`;
}
