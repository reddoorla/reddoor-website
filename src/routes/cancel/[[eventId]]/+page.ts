import metaImage from "$lib/assets/og/cancel.jpg";
import type { PageLoad } from "./$types";

/** See /reschedule/[eventId]/+page.ts — same reasoning, same bearer id. */
export const prerender = false;

export const load: PageLoad = () => ({
  title: "Cancel Your Call | Reddoor Creative",
  meta_title: "Cancel Your Call | Reddoor Creative",
  meta_description: "Cancel or move your intro call with Reddoor Creative.",
  meta_image: metaImage,
  meta_robots: "noindex, nofollow",
  meta_referrer: "no-referrer",
});
