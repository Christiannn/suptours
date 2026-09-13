import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

// The home page reads everything it renders off `data`, so it cannot be
// rendered bare — this test predates the page growing a load function.
//
// `data` is the merge of +layout.server.ts and +page.server.ts, so both halves
// have to be here. This is the empty-but-valid shape: a signed-out visitor
// with no content yet, which is also the case most likely to break on a null.
const emptyData = {
	// from +layout.server.ts
	user: null,
	session: null,
	isAdmin: false,
	profileAvatarUrl: null,
	profileDisplayName: null,
	myBookings: [],
	homeTrustImageUrl: null,
	// from +page.server.ts
	posts: [],
	activeGallery: null,
	galleryImages: [],
	featuredTours: [],
	recentReviews: []
};

describe('/+page.svelte', () => {
	it('should render h1', async () => {
		render(Page, { data: emptyData, form: null });

		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
	});

	it('offers signup to a signed-out visitor', async () => {
		render(Page, { data: emptyData, form: null });

		const join = page.getByRole('link', { name: /join the community/i });
		await expect.element(join).toBeInTheDocument();
	});
});
