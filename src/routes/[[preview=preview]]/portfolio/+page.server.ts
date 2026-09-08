import { createClient } from "$lib/prismicio";
import { filter } from "@prismicio/client";
import { error } from "@sveltejs/kit";
import { ogCardPath } from "$lib/og/url";
import { loadRouteMeta } from "$lib/server/route-meta";
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
  } catch (err) {
    // A Prismic failure renders the error page as a 503, not an unhandled 500
    // — but the real cause must still reach the logs.
    console.error("[portfolio] Prismic load failed:", err);
    throw error(503, { message: "Content is temporarily unavailable — please try again." });
  }

  // Editor overrides from the page's route_meta document, if one exists.
  const meta = await loadRouteMeta(client, "portfolio");
  return {
    allProjects: allProjects,
    title: meta?.meta_title || "Portfolio | Reddoor Creative",
    meta_description:
      meta?.meta_description ||
      "We design beautiful marketing materials that help you thrive. See our work.",
    meta_title: meta?.meta_title || "Portfolio | Reddoor Creative",
    meta_image: meta?.meta_image || ogCardPath("site", "portfolio"),
  };
};
