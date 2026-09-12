import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

// The home page reads everything it renders off `data`, so it cannot be
// rendered bare — this test predates the page growing a load function. This is
// the empty-but-valid shape: a signed-out visitor with no content yet, which
// is also the case most likely to break on a null.
const emptyData = {
	user: null,
	posts: [],
	activeGallery: null,
	galleryImages: [],
	featuredTours: [],
	recentReviews: []
};

describe('/+page.svelte', () => {
	it('should render h1', async () => {
		render(Page, { data: emptyData });

		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
	});

	it('offers signup to a signed-out visitor', async () => {
		render(Page, { data: emptyData });

		const join = page.getByRole('link', { name: /join the community/i });
		await expect.element(join).toBeInTheDocument();
	});
});
