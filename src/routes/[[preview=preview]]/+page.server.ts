import { asText } from "@prismicio/client";

import { createClient } from "$lib/prismicio";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch, cookies }) => {
  const client = createClient({ fetch, cookies });

  let page, logoSoup, openingAnimation;
  try {
    // All three are essential to the page (the template dereferences them
    // unconditionally). Parallel fetch; a Prismic failure renders the error
    // page as a 503 instead of an unhandled 500. (No fetchLinks here: unlike
    // the SliceZone routes, the home template renders no SliceZone — its
    // sections are hardcoded — so there are no gallery relationships to
    // resolve.)
    [page, logoSoup, openingAnimation] = await Promise.all([
      client.getByUID("page", "home"),
      client.getSingle("logo_soup"),
      client.getSingle("opening_animation"),
    ]);
  } catch (err) {
    // Log the real cause — the controlled 503 must not silence what the old
    // unhandled 500 used to print.
    console.error("[home] Prismic load failed:", err);
    throw error(503, { message: "Content is temporarily unavailable — please try again." });
  }

  return {
    page,
    logoSoup,
    openingAnimation,
    title: asText(page.data.title),
    meta_description: page.data.meta_description,
    meta_title: page.data.meta_title,
    meta_image: page.data.meta_image.url,
  };
};

export function entries() {
  return [{}];
}
