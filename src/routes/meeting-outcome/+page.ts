import metaImage from "$lib/assets/icons/logos/printedReddoor.png";
import type { PageLoad } from "./$types";

/**
 * Not prerendered, and never indexed: this is an internal tool reached with a
 * key in the query string. `no-referrer` keeps that key out of the Referer of
 * anything the page loads.
 */
export const prerender = false;

export const load: PageLoad = () => ({
  title: "Call Outcome | Reddoor Creative",
  meta_title: "Call Outcome | Reddoor Creative",
  meta_description: "Internal: record the outcome of an intro call.",
  meta_image: metaImage,
  meta_robots: "noindex, nofollow",
  meta_referrer: "no-referrer",
});
