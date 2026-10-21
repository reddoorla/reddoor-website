import { loadFunnelCopy } from "$lib/server/funnel-copy";
import type { PageServerLoad } from "./$types";

/**
 * Read per request, with the cookies; see /cancel's for why that costs nothing.
 */
export const load: PageServerLoad = async ({ fetch, cookies }) => ({
  copy: await loadFunnelCopy({ fetch, cookies }),
});
