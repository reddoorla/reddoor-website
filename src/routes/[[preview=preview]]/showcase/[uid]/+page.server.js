import { createClient } from '$lib/prismicio';
import { isFilled } from '@prismicio/client';

export async function load({ params, fetch, cookies }) {
	const client = createClient({ fetch, cookies });

	let page = await client.getByUID('showcase', params.uid);

    return {
		page,
		title: page.data.title+" | Reddoor Creative",
        meta_description: page.data.meta_description,
		meta_title: page.data.meta_title,
		meta_image: page.data.meta_image.url
    }
}

export async function entries() {
	const client = createClient();

	const pages = await client.getAllByType('project');

	return pages.map((page) => {
		return { uid: page.uid };
	});
}
