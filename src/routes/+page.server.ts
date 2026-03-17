import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals: { supabase } }) => {
	// Fetch public blog posts (team_id IS NULL, is_draft = false) for home page cards
	const { data: posts } = await supabase
		.from('blog_posts')
		.select('id, title, slug, created_at')
		.is('team_id', null)
		.eq('is_draft', false)
		.order('created_at', { ascending: false })
		.limit(4);

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
		: { data: [] };

	const mockGalleryImages = [
		{
			id: 'mock-1',
			image_url: 'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?auto=format&fit=crop&w=1400&q=80',
			description: 'Calm mountain valley at sunrise.',
			quote: 'The best views appear after the longest climb.',
			link_to_url: 'https://unsplash.com/photos/69b98201ea1c',
			hidden: false,
			tags: ['nature', 'mountains']
		},
		{
			id: 'mock-2',
			image_url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80',
			description: 'Open road and wide horizon.',
			quote: null,
			link_to_url: 'https://unsplash.com/photos/56623f02e42e',
			hidden: false,
			tags: ['travel']
		},
		{
			id: 'mock-3',
			image_url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80',
			description: 'Forest mirror reflection in still water.',
			quote: 'Breathe deeply, move gently.',
			link_to_url: 'https://unsplash.com/photos/af3ef285b470',
			hidden: false,
			tags: ['forest', 'water']
		}
	];

	return {
		posts: posts ?? [],
		activeGallery,
		galleryImages: galleryImages && galleryImages.length > 0 ? galleryImages : mockGalleryImages
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
