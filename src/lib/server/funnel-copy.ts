import type { Cookies } from "@sveltejs/kit";
import { createClient } from "$lib/prismicio";
import { readFunnelCopy, type FunnelCopy } from "$lib/funnel-copy/copy";

/**
 * The booking funnel's copy for one load, from the `funnel_copy` singleton.
 *
 * Passing `cookies` makes a Prismic preview session see its release; the
 * prerendered pages pass none and read the published document at build time
 * (a publish triggers a rebuild of both sites through the Prismic build hooks).
 * Never throws: see `readFunnelCopy`.
 */
export function loadFunnelCopy(event: {
  fetch: typeof fetch;
  cookies?: Cookies;
}): Promise<FunnelCopy> {
  return readFunnelCopy(createClient({ fetch: event.fetch, cookies: event.cookies }));
}
