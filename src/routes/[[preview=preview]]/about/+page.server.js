import metaImage from "$lib/assets/icons/logos/printedReddoor.png"
import { createClient } from '$lib/prismicio';

export async function load({ fetch, cookies }) {
	const client = createClient({ fetch, cookies } );

	const logoSoup = await client.getSingle('logo_soup');

	return {


		title: "About | Reddoor Creative",
		meta_description: "We design beautiful marketing materials that help you thrive. Let us tell you how.",
		meta_title: "About | Reddoor Creative",
		meta_image: metaImage,
		logoSoup
	};
}
