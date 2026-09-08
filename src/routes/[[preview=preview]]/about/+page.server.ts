import { ogCardPath } from "$lib/og/url";
import { createClient } from "$lib/prismicio";
import { loadRouteMeta } from "$lib/server/route-meta";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch, cookies }) => {
  const client = createClient({ fetch, cookies });

  let logoSoup;
  try {
    logoSoup = await client.getSingle("logo_soup");
  } catch (err) {
    // A Prismic failure renders the error page as a 503, not an unhandled 500
    // — but the real cause must still reach the logs.
    console.error("[about] Prismic load failed:", err);
    throw error(503, { message: "Content is temporarily unavailable — please try again." });
  }

  // Editor overrides from the page's route_meta document, if one exists.
  const meta = await loadRouteMeta(client, "about");
  return {
    title: meta?.meta_title || "About | Reddoor Creative",
    meta_description:
      meta?.meta_description ||
      "We design beautiful marketing materials that help you thrive. Let us tell you how.",
    meta_title: meta?.meta_title || "About | Reddoor Creative",
    meta_image: meta?.meta_image || ogCardPath("site", "about"),
    logoSoup,
  };
};
