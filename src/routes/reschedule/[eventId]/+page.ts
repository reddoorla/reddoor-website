import metaImage from "$lib/assets/icons/logos/printedReddoor.png";
import type { PageLoad } from "./$types";

/**
 * Never prerendered — the path carries an appointment id. Nothing about the
 * booking is server-rendered either; the shell fetches it from the browser, so
 * no named person's time is ever baked into HTML a CDN might hold.
 */
export const prerender = false;

export const load: PageLoad = () => ({
  title: "Reschedule Your Call | Reddoor Creative",
  meta_title: "Reschedule Your Call | Reddoor Creative",
  meta_description: "Move your intro call with Reddoor Creative to a time that suits you better.",
  meta_image: metaImage,
  // An appointment id in the URL is a bearer token, so it must not ride along
  // in the Referer of anything this page loads, and it has no business in
  // anyone's search index.
  meta_robots: "noindex, nofollow",
  meta_referrer: "no-referrer",
});
