import metaImage from "$lib/assets/icons/logos/printedReddoor.png";
import type { PageLoad } from "./$types";

/** See /reschedule/[eventId]/+page.ts — same reasoning, same bearer id. */
export const prerender = false;

export const load: PageLoad = () => ({
  title: "Add Your Call to Your Calendar | Reddoor Creative",
  meta_title: "Add Your Call to Your Calendar | Reddoor Creative",
  meta_description: "Save your Reddoor Creative intro call to Google, Outlook or Apple Calendar.",
  meta_image: metaImage,
  meta_robots: "noindex, nofollow",
  meta_referrer: "no-referrer",
});
