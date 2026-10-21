import { loadFunnelCopy } from "$lib/server/funnel-copy";
import type { PageServerLoad } from "./$types";

/**
 * Read per request (this route is never prerendered), with the cookies so a
 * Prismic preview session sees its release. It runs alongside the layout's own
 * Prismic read, so it adds no round trip in series. Never throws.
 */
export const load: PageServerLoad = async ({ fetch, cookies }) => ({
  copy: await loadFunnelCopy({ fetch, cookies }),
});
