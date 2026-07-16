import { createClient } from "$lib/prismicio";
import { filter } from "@prismicio/client";
import { error } from "@sveltejs/kit";
import metaImage from "$lib/assets/icons/logos/printedReddoor.png";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch, cookies }) => {
  const client = createClient({ fetch, cookies });

  let allProjects;
  try {
    allProjects = await client.getAllByType("project", {
      orderings: {
        field: "document.first_publication_date",
        direction: "asc",
      },
      filters: [filter.not("document.tags", ["hide"])],
    });
  } catch {
    // A Prismic failure renders the error page as a 503, not an unhandled 500.
    throw error(503, { message: "Content is temporarily unavailable — please try again." });
  }

  return {
    allProjects: allProjects,
    title: "Portfolio | Reddoor Creative",
    meta_description: "We design beautiful marketing materials that help you thrive. See our work.",
    meta_title: "Portfolio | Reddoor Creative",
    meta_image: metaImage,
  };
};
