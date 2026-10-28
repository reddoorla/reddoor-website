import { loadBookedProjects, loadFunnelCopy } from "$lib/server/funnel-copy";
import type { PageServerLoad } from "./$types";

/**
 * The page's words, read from Prismic at build time: this route prerenders, so
 * no request ever waits on the CMS, and a publish rebuilds it through the Prismic
 * build hook. No cookies are read, which is what keeps it prerenderable;
 * /preview/funnel is where a preview session sees a release.
 */
export const load: PageServerLoad = async ({ fetch }) => {
  const copy = await loadFunnelCopy({ fetch });
  // The booked state's "Check out Our Work", read at build time with the copy.
  return { copy, projects: await loadBookedProjects({ fetch }, copy.booked.projectUids) };
};
