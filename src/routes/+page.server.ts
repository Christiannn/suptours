import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals: { supabase } }) => {
	const today = new Date().toISOString().split('T')[0];

	// Fetch public blog posts
	const { data: posts } = await supabase
		.from('blog_posts')
		.select('id, title, slug, created_at')
		.is('team_id', null)
		.eq('is_draft', false)
		.order('created_at', { ascending: false })
		.limit(3);

	// Fetch active gallery
	const { data: activeGallery } = await supabase
		.from('galleries')
		.select('id, description')
		.eq('active', true)
		.order('edited_on', { ascending: false })
		.limit(1)
		.maybeSingle();

	const { data: galleryImages } = activeGallery
		? await supabase
				.from('gallery_images')
				.select('id, image_url, description, quote, link_to_url, hidden, tags')
				.eq('gallery_id', activeGallery.id)
				.eq('hidden', false)
				.order('edited_on', { ascending: false })
				.limit(6)
		: { data: [] };

	// Fetch featured/upcoming tours
	const { data: featuredTours } = await supabase
		.from('tours')
		.select('id, title, image_url, start_date, start_time, locality, tags, source, max_participants, featured')
		.eq('status', 'published')
		.gte('start_date', today)
		.order('featured', { ascending: false })
		.order('start_date', { ascending: true })
		.limit(4);

	// Fetch recent approved reviews
	const { data: recentReviews } = await supabase
		.from('tour_reviews')
		.select('id, rating, comment, created_at, tour_id, user_id')
		.eq('approved', true)
		.order('created_at', { ascending: false })
		.limit(3);

	// Get profiles for reviewers
	let reviewerProfiles: Record<string, string | null> = {};
	if (recentReviews && recentReviews.length > 0) {
		const userIds = [...new Set(recentReviews.map(r => r.user_id))];
		const { data: profiles } = await supabase
			.from('profiles')
			.select('id, display_name')
			.in('id', userIds);
		if (profiles) {
			for (const p of profiles) {
				reviewerProfiles[p.id] = p.display_name;
			}
		}
	}

	const enrichedReviews = (recentReviews ?? []).map(r => ({
		...r,
		reviewer_name: reviewerProfiles[r.user_id] ?? 'Anonymous'
	}));

	const { data: homeTrustRow } = await supabase
		.from('site_settings')
		.select('value')
		.eq('key', 'home_trust_image_url')
		.maybeSingle();

	const mockGalleryImages = [
		{
			id: 'mock-1',
			image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
			description: 'SUP at sunset on calm waters.',
			quote: 'The best views appear after the longest paddle.',
			link_to_url: null,
			hidden: false,
			tags: ['sup', 'sunset']
		},
		{
			id: 'mock-2',
			image_url: 'https://images.unsplash.com/photo-1502680390548-bdbac40a2aa4?auto=format&fit=crop&w=800&q=80',
			description: 'Morning paddle through the canals.',
			quote: null,
			link_to_url: null,
			hidden: false,
			tags: ['sup', 'morning']
		},
		{
			id: 'mock-3',
			image_url: 'https://images.unsplash.com/photo-1526188717906-ab4a2f949f78?auto=format&fit=crop&w=800&q=80',
			description: 'Group SUP adventure along the coast.',
			quote: 'Together on the water.',
			link_to_url: null,
			hidden: false,
			tags: ['sup', 'group']
		}
	];

	return {
		posts: posts ?? [],
		activeGallery,
		galleryImages: galleryImages && galleryImages.length > 0 ? galleryImages : mockGalleryImages,
		featuredTours: featuredTours ?? [],
		recentReviews: enrichedReviews,
		homeTrustImageUrl: homeTrustRow?.value?.trim() ? homeTrustRow.value : null
	};
}) satisfies PageServerLoad;

export const actions = {
	newsletter: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = (formData.get('email') as string)?.trim();

		if (!email) {
			return { newsletterMessage: 'Email is required', newsletterSuccess: false };
		}

		const { error } = await supabase.from('newsletter_subscribers').insert({
			email,
			user_id: null,
			team_id: null
		});

		if (error) {
			if (error.code === '23505') {
				return { newsletterMessage: 'Already subscribed', newsletterSuccess: true };
			}
			return { newsletterMessage: error.message, newsletterSuccess: false };
		}

		return { newsletterMessage: 'Thanks for subscribing!', newsletterSuccess: true };
	}
} satisfies Actions;
