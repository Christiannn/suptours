import { requireUser } from '$lib/auth/requireUser';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const GALLERY_BUCKET = 'gallery-images';

function parseTags(raw: FormDataEntryValue | null): string[] {
	return String(raw ?? '')
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
}

function sanitizeFileName(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
}

function extractBucketPathFromPublicUrl(url: string): string | null {
	const marker = `/storage/v1/object/public/${GALLERY_BUCKET}/`;
	const idx = url.indexOf(marker);
	if (idx === -1) return null;
	return decodeURIComponent(url.slice(idx + marker.length));
}

export const load = (async (event) => {
	await requireUser(event);
	const { supabase } = event.locals;

	const { data: galleries, error } = await supabase
		.from('galleries')
		.select(
			'id, description, active, edited_by, edited_on, gallery_images(id, gallery_id, image_url, description, quote, tags, link_to_url, hidden, edited_by, edited_on)'
		)
		.order('edited_on', { ascending: false });

	if (error) {
		return {
			galleries: [],
			errorMessage: 'Could not load galleries.'
		};
	}

	return {
		galleries:
			galleries?.map((gallery) => ({
				...gallery,
				gallery_images: [...(gallery.gallery_images ?? [])].sort((a, b) =>
					a.edited_on < b.edited_on ? 1 : -1
				)
			})) ?? [],
		errorMessage: null
	};
}) satisfies PageServerLoad;

export const actions = {
	createGallery: async (event) => {
		const { request, locals: { supabase } } = event;
		const { user } = await requireUser(event);
		const formData = await request.formData();

		const description = String(formData.get('description') ?? '').trim() || null;
		const active = formData.get('active') === 'on';

		const { data: createdGallery, error } = await supabase
			.from('galleries')
			.insert({
				description,
				active,
				edited_by: user.id
			})
			.select('id')
			.single();

		if (error) {
			return fail(500, { message: 'Could not create gallery.' });
		}

		return { message: 'Gallery created.', success: true, galleryId: createdGallery.id };
	},
	updateGallery: async (event) => {
		const { request, locals: { supabase } } = event;
		const { user } = await requireUser(event);
		const formData = await request.formData();

		const galleryId = String(formData.get('gallery_id') ?? '').trim();
		const description = String(formData.get('description') ?? '').trim() || null;
		const active = formData.get('active') === 'on';

		if (!galleryId) {
			return fail(400, { message: 'Missing gallery id.' });
		}

		const { error } = await supabase
			.from('galleries')
			.update({ description, active, edited_by: user.id })
			.eq('id', galleryId);

		if (error) {
			return fail(500, { message: 'Could not update gallery.' });
		}

		return { message: 'Gallery updated.', success: true };
	},
	deleteGallery: async (event) => {
		const { request, locals: { supabase } } = event;
		await requireUser(event);
		const formData = await request.formData();
		const galleryId = String(formData.get('gallery_id') ?? '').trim();

		if (!galleryId) {
			return fail(400, { message: 'Missing gallery id.' });
		}

		const { error } = await supabase.from('galleries').delete().eq('id', galleryId);
		if (error) {
			return fail(500, { message: 'Could not delete gallery.' });
		}

		return { message: 'Gallery deleted.', success: true };
	},
	createImage: async (event) => {
		const { request, locals: { supabase } } = event;
		const { user } = await requireUser(event);
		const formData = await request.formData();

		const galleryId = String(formData.get('gallery_id') ?? '').trim();
		const imageUrl = String(formData.get('image_url') ?? '').trim();
		const description = String(formData.get('description') ?? '').trim() || null;
		const quote = String(formData.get('quote') ?? '').trim() || null;
		const linkToUrl = String(formData.get('link_to_url') ?? '').trim() || null;
		const hidden = formData.get('hidden') === 'on';
		const tags = parseTags(formData.get('tags'));

		if (!galleryId || !imageUrl) {
			return fail(400, { message: 'Gallery and image URL are required.' });
		}

		const { error } = await supabase.from('gallery_images').insert({
			gallery_id: galleryId,
			image_url: imageUrl,
			description,
			quote,
			link_to_url: linkToUrl,
			hidden,
			tags,
			edited_by: user.id
		});

		if (error) {
			return fail(500, { message: 'Could not create image item.' });
		}

		return { message: 'Image item created.', success: true };
	},
	uploadImage: async (event) => {
		const { request, locals: { supabase } } = event;
		const { user } = await requireUser(event);
		const formData = await request.formData();

		const galleryId = String(formData.get('gallery_id') ?? '').trim();
		const file = formData.get('image_file');
		const description = String(formData.get('description') ?? '').trim() || null;
		const quote = String(formData.get('quote') ?? '').trim() || null;
		const linkToUrl = String(formData.get('link_to_url') ?? '').trim() || null;
		const hidden = formData.get('hidden') === 'on';
		const tags = parseTags(formData.get('tags'));

		if (!galleryId || !(file instanceof File) || file.size === 0) {
			return fail(400, { message: 'Gallery and image file are required.' });
		}

		const fileName = sanitizeFileName(file.name || 'image.jpg');
		const filePath = `${user.id}/${galleryId}/${Date.now()}-${fileName}`;

		const { error: uploadError } = await supabase.storage.from(GALLERY_BUCKET).upload(filePath, file, {
			cacheControl: '3600',
			upsert: false,
			contentType: file.type || 'image/jpeg'
		});

		if (uploadError) {
			return fail(500, { message: 'Could not upload image.' });
		}

		const { data: publicUrlData } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(filePath);
		const imageUrl = publicUrlData.publicUrl;

		const { error: insertError } = await supabase.from('gallery_images').insert({
			gallery_id: galleryId,
			image_url: imageUrl,
			description,
			quote,
			link_to_url: linkToUrl,
			hidden,
			tags,
			edited_by: user.id
		});

		if (insertError) {
			return fail(500, { message: 'Uploaded file but failed to save image metadata.' });
		}

		return { message: 'Image uploaded.', success: true };
	},
	updateImage: async (event) => {
		const { request, locals: { supabase } } = event;
		const { user } = await requireUser(event);
		const formData = await request.formData();

		const imageId = String(formData.get('image_id') ?? '').trim();
		const description = String(formData.get('description') ?? '').trim() || null;
		const quote = String(formData.get('quote') ?? '').trim() || null;
		const linkToUrl = String(formData.get('link_to_url') ?? '').trim() || null;
		const hidden = formData.get('hidden') === 'on';
		const tags = parseTags(formData.get('tags'));

		if (!imageId) {
			return fail(400, { message: 'Missing image id.' });
		}

		const { error } = await supabase
			.from('gallery_images')
			.update({
				description,
				quote,
				link_to_url: linkToUrl,
				hidden,
				tags,
				edited_by: user.id
			})
			.eq('id', imageId);

		if (error) {
			return fail(500, { message: 'Could not update image item.' });
		}

		return { message: 'Image item updated.', success: true };
	},
	deleteImage: async (event) => {
		const { request, locals: { supabase } } = event;
		await requireUser(event);
		const formData = await request.formData();
		const imageId = String(formData.get('image_id') ?? '').trim();

		if (!imageId) {
			return fail(400, { message: 'Missing image id.' });
		}

		const { data: item } = await supabase
			.from('gallery_images')
			.select('image_url')
			.eq('id', imageId)
			.maybeSingle();

		if (item?.image_url) {
			const bucketPath = extractBucketPathFromPublicUrl(item.image_url);
			if (bucketPath) {
				await supabase.storage.from(GALLERY_BUCKET).remove([bucketPath]);
			}
		}

		const { error } = await supabase.from('gallery_images').delete().eq('id', imageId);
		if (error) {
			return fail(500, { message: 'Could not delete image item.' });
		}

		return { message: 'Image item deleted.', success: true };
	}
} satisfies Actions;
