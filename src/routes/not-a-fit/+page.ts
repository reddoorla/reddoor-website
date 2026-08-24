import metaImage from "$lib/assets/og/not-a-fit.jpg";
import type { PageLoad } from "./$types";

/**
 * The official "we are not a good fit" page — Tim's ask, 2026-08-24. The
 * inquiry modal lands here instead of /schedule when the budget gate is
 * answered "No" (see BUDGET_GATE in $lib/ghl/questions): the visitor said the
 * work is beyond their budget, so the honest next page is this one, not a
 * calendar.
 *
 * Static, so it prerenders — explicit like /schedule's flag, because nothing
 * links here (the visitor arrives by `goto`) and an uncrawled "auto" route
 * would quietly fall back to SSR.
 */
export const prerender = true;

export const load: PageLoad = () => ({
  title: "Not the Right Fit | Reddoor Creative",
  meta_title: "Not the Right Fit | Reddoor Creative",
  meta_description:
    "An honest answer beats a sales call: where Reddoor Creative isn't the right studio for your budget today, and where that leaves us.",
  meta_image: metaImage,
  // Same reasoning as /schedule: the page is reachable by link and that is
  // fine, but a stranger finding it cold in search would be reading the end of
  // a conversation they never had. Out of the index, out of the sitemap.
  meta_robots: "noindex, follow",
});
