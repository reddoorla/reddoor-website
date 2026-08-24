import metaImage from "$lib/assets/og/unsubscribed.jpg";
import type { PageLoad } from "./$types";

/** Static shell — the one write is a browser fetch — so it prerenders. */
export const prerender = true;

export const load: PageLoad = () => ({
  title: "You're Unsubscribed | Reddoor Creative",
  meta_title: "You're Unsubscribed | Reddoor Creative",
  meta_description: "You've been removed from Reddoor Creative's marketing emails.",
  meta_image: metaImage,
  // A confirmation page has nothing to offer a search result, and indexing it
  // would put "unsubscribe" pages of ours into results for our own brand.
  meta_robots: "noindex, follow",
});
