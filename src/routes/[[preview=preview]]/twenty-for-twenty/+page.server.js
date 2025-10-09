import metaImage from "$lib/assets/icons/logos/printedReddoor.png"

export async function load({ params, fetch, cookies }) {
	return {

		title: "20 for 20 | Reddoor Creative",
		meta_description: "In our twenty years we've been priviledged to work with amazing clients on hundreds of projects. Here are twenty of our favorites.",
		meta_title: "20 for 20 | Reddoor Creative",
		meta_image: metaImage
	};
}
