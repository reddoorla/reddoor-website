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
    // page as a 503 instead of an unhandled 500.
    // fetchLinks: the same gallery resolution every other SliceZone route
    // passes — without it a gallery-backed slideshow authored on the homepage
    // silently degrades to a plain image.
    [page, logoSoup, openingAnimation] = await Promise.all([
      client.getByUID("page", "home", { fetchLinks: ["gallery.images"] }),
      client.getSingle("logo_soup"),
      client.getSingle("opening_animation"),
    ]);
  } catch {
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
