import metaImage from "$lib/assets/og/resubscribed.jpg";
import type { PageLoad } from "./$types";

/** Static — see /email/unsubscribed. */
export const prerender = true;

export const load: PageLoad = () => ({
  title: "You're Subscribed | Reddoor Creative",
  meta_title: "You're Subscribed | Reddoor Creative",
  meta_description: "You're back on Reddoor Creative's email list.",
  meta_image: metaImage,
  meta_robots: "noindex, follow",
});
