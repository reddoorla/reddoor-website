import { loadFunnelCopy } from "$lib/server/funnel-copy";
import type { PageServerLoad } from "./$types";

/**
 * The page's words, read from Prismic at build time: this route prerenders, so
 * no request ever waits on the CMS, and a publish rebuilds it through the Prismic
 * build hook. No cookies are read, which is what keeps it prerenderable;
 * /preview/funnel is where a preview session sees a release.
 */
export const load: PageServerLoad = async ({ fetch }) => ({
  copy: await loadFunnelCopy({ fetch }),
});
