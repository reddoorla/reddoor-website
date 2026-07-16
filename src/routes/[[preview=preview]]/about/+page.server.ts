import metaImage from "$lib/assets/icons/logos/printedReddoor.png";
import { createClient } from "$lib/prismicio";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch, cookies }) => {
  const client = createClient({ fetch, cookies });

  let logoSoup;
  try {
    logoSoup = await client.getSingle("logo_soup");
  } catch {
    // A Prismic failure renders the error page as a 503, not an unhandled 500.
    throw error(503, { message: "Content is temporarily unavailable — please try again." });
  }

  return {
    title: "About | Reddoor Creative",
    meta_description:
      "We design beautiful marketing materials that help you thrive. Let us tell you how.",
    meta_title: "About | Reddoor Creative",
    meta_image: metaImage,
    logoSoup,
  };
};
