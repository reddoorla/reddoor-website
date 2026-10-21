import { loadFunnelCopy } from "$lib/server/funnel-copy";
import { sampleVisitor } from "$lib/funnel-copy/preview";
import type { PageServerLoad } from "./$types";

/**
 * Every state of the booking funnel on one page, from sample data, so Tim can
 * read his copy without booking a call (2026-10-21: "The only way for me to
 * currently check these is to do the process").
 *
 * Opening the `funnel_copy` document's preview in Prismic lands here (see
 * /api/preview), and the cookies make this load read that preview's release.
 * Without a preview session it shows the published copy, or the built-in
 * wording while nothing is published. Never prerendered: it reads cookies.
 */
export const prerender = false;

export const load: PageServerLoad = async ({ fetch, cookies }) => ({
  copy: await loadFunnelCopy({ fetch, cookies }),
  visitor: sampleVisitor(new Date()),
  title: "Booking Pages Preview | Reddoor Creative",
  meta_title: "Booking Pages Preview | Reddoor Creative",
  meta_description: "Every state of the booking pages, with sample data.",
  meta_robots: "noindex, nofollow",
});
