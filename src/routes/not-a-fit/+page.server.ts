import { loadFunnelCopy } from "$lib/server/funnel-copy";
import type { PageServerLoad } from "./$types";

/**
 * Read at build time for the same reasons as /schedule's (see there).
 */
export const load: PageServerLoad = async ({ fetch }) => ({
  copy: await loadFunnelCopy({ fetch }),
});
